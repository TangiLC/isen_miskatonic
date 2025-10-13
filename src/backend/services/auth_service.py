import os
from dotenv import load_dotenv
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from models.user import User, UserRole
from schemas.user import UserCreate, UserResponse, TokenResponse
from utils.sq_database import Connection

load_dotenv()

# Configuration JWT
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-unsafe-secret")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60


class AuthService(Connection):
    """
    Service d'authentification unifié gérant :
    - Authentification avec BDD (login/register)
    - Génération et validation de tokens JWT
    - Gestion des utilisateurs
    """

    # ==================== JWT TOKEN MANAGEMENT ====================

    @classmethod
    def create_access_token(
        cls,
        subject: str,
        claims: Optional[Dict[str, Any]] = None,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """
        Crée un token JWT signé.

        Args:
            subject: Identifiant principal (généralement l'email)
            claims: Données supplémentaires à inclure dans le token
            expires_delta: Durée de validité personnalisée

        Returns:
            str: Token JWT encodé
        """
        to_encode: Dict[str, Any] = {}
        if claims:
            to_encode.update(claims)

        now = datetime.now(timezone.utc)
        exp = now + (expires_delta or timedelta(minutes=JWT_EXPIRE_MIN))

        to_encode.update(
            {"sub": subject, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
        )

        return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)

    @staticmethod
    def decode_token(token: str) -> Optional[User]:
        """
        Décode et valide un token JWT.

        Args:
            token: Token JWT à décoder

        Returns:
            Optional[User]: Utilisateur extrait du token, ou None si invalide
        """
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            payload["password"] = "****"
            payload["isAuth"] = True
            return User.model_validate(payload)
        except jwt.ExpiredSignatureError:
            print("Token expiré")
            return None
        except jwt.InvalidTokenError as e:
            print(f"Token invalide: {e}")
            return None
        except Exception as e:
            print(f"Erreur lors du décodage du token: {e}")
            return None

    # ==================== AUTHENTICATION WITH DATABASE ====================

    @classmethod
    async def login(
        cls, username: str, password: str
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Authentifie un utilisateur avec la base de données.

        Args:
            username: Nom d'utilisateur
            password: Mot de passe en clair

        Returns:
            Tuple[Optional[User], Optional[str]]: (Utilisateur, Token) ou (None, None)
        """
        try:
            cls.connect()

            query = """
                SELECT u.*, r.role as role 
                FROM users u 
                LEFT JOIN roles r ON u.role_id = r.id 
                WHERE u.name = ?
            """
            cls.cursor.execute(query, (username,))
            result = cls.cursor.fetchone()

            if not result:
                print(f"Utilisateur non trouvé: {username}")
                return None, None

            # Vérification du mot de passe avec bcrypt
            stored_password = result["password"]
            if isinstance(stored_password, str):
                stored_password = stored_password.encode("utf-8")

            if not bcrypt.checkpw(password.encode("utf-8"), stored_password):
                print(f"Mot de passe incorrect pour: {username}")
                return None, None

            # Création de l'utilisateur authentifié
            user_data = dict(result)
            user_data.setdefault("isAuth", True)
            authenticated_user = User(**user_data)

            # Génération du token
            token = cls._generate_token_for_user(authenticated_user)

            print(f"✅ Authentification réussie: {authenticated_user.name}/{token}")
            return authenticated_user, token

        except Exception as err:
            print(f"❌ Erreur lors de l'authentification: {err}")
            return None, None
        finally:
            cls.close()

    @classmethod
    async def register(cls, user_data: UserCreate) -> Optional[TokenResponse]:
        """
        Crée un nouveau compte utilisateur.

        Args:
            user_data: Données du nouvel utilisateur

        Returns:
            Optional[TokenResponse]: Réponse avec token et user, ou None si échec
        """
        try:
            cls.connect()
            print("📡 Connexion BDD réussie")

            # Vérification de l'email unique
            if await cls._email_exists(user_data.email):
                print(f"⚠️ Email déjà utilisé: {user_data.email}")
                return None

            # Hash du mot de passe
            hashed_password = cls._hash_password(user_data.password)

            # Récupération du role_id
            role_id = await cls._get_role_id(user_data.role.value)
            if not role_id:
                raise RuntimeError(f"Rôle '{user_data.role.value}' introuvable")

            # Insertion en base
            user_id = await cls._insert_user(
                user_data.name, user_data.email, hashed_password, role_id
            )

            cls.connexion.commit()
            print(f"✅ Utilisateur créé avec ID: {user_id}")

            # Récupération de l'utilisateur créé
            created_user = await cls._get_user_by_id(user_id)
            if not created_user:
                print("❌ Impossible de récupérer l'utilisateur créé")
                return None

            # Génération du token
            token = cls._generate_token_for_user(created_user)

            return TokenResponse(
                access_token=token,
                user=UserResponse(
                    id=created_user.id,
                    name=created_user.name,
                    email=created_user.email,
                    role=created_user.role,
                ),
            )

        except Exception as err:
            print(f"❌ Erreur lors de la création du compte: {err}")
            if cls.connexion:
                cls.connexion.rollback()
            return None
        finally:
            cls.close()

    # ==================== TEST MODE (sans BDD) ====================

    @classmethod
    async def create_test_token(cls, payload: UserCreate) -> TokenResponse:
        """
        Génère un JWT sans interaction BDD (mode test).

        Args:
            payload: Données utilisateur pour créer le token

        Returns:
            TokenResponse: Réponse contenant le token et les infos utilisateur
        """
        user = User(
            id=payload.id,
            name=payload.name,
            email=payload.email,
            role=payload.role,
            password=None,
        )

        token = cls._generate_token_for_user(user, scope="test")

        return TokenResponse(
            access_token=token,
            user=UserResponse(
                id=user.id, name=user.name, email=user.email, role=user.role
            ),
        )

    # ==================== USER QUERIES ====================

    @classmethod
    async def get_user_by_id(cls, user_id: int) -> Optional[User]:
        """Récupère un utilisateur par son ID."""
        return await cls._get_user_by_id(user_id)

    @classmethod
    async def get_user_name(cls, user_id: int) -> str:
        """Récupère le nom d'un utilisateur par son ID."""
        try:
            cls.connect()
            query = "SELECT name FROM users WHERE id = ?"
            cls.cursor.execute(query, (user_id,))
            result = cls.cursor.fetchone()

            if result and "name" in result.keys():
                return result["name"]
            return "Inconnu"
        except Exception as err:
            print(f"❌ Erreur getUserName: {err}")
            return "Inconnu"
        finally:
            cls.close()

    # ==================== PRIVATE HELPER METHODS ====================

    @classmethod
    def _generate_token_for_user(cls, user: User, scope: Optional[str] = None) -> str:
        """Génère un token JWT pour un utilisateur donné."""
        token_claims = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else user.role,
        }

        if scope:
            token_claims["scope"] = scope

        return cls.create_access_token(subject=user.email, claims=token_claims)

    @staticmethod
    def _hash_password(password: str) -> str:
        """Hash un mot de passe avec bcrypt."""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    @classmethod
    async def _email_exists(cls, email: str) -> bool:
        """Vérifie si un email existe déjà en base."""
        query = "SELECT COUNT(*) as count FROM users WHERE email = ?"
        cls.cursor.execute(query, (email,))
        result = cls.cursor.fetchone()
        return result and result["count"] > 0

    @classmethod
    async def _get_role_id(cls, role_name: str) -> Optional[int]:
        """Récupère l'ID d'un rôle par son nom."""
        query = "SELECT id FROM Roles WHERE role = ?"
        cls.cursor.execute(query, (role_name,))
        result = cls.cursor.fetchone()
        return result["id"] if result else None

    @classmethod
    async def _insert_user(
        cls, name: str, email: str, hashed_password: str, role_id: int
    ) -> int:
        """Insère un nouvel utilisateur en base."""
        query = """
            INSERT INTO users (name, email, password, role_id)
            VALUES (?, ?, ?, ?)
        """
        cls.cursor.execute(query, (name, email, hashed_password, role_id))
        return cls.cursor.lastrowid

    @classmethod
    async def _get_user_by_id(cls, user_id: int) -> Optional[User]:
        """Récupère un utilisateur complet par son ID."""
        try:
            cls.connect()
            query = """
                SELECT u.*, r.role as role 
                FROM users u 
                LEFT JOIN roles r ON u.role_id = r.id 
                WHERE u.id = ?
            """
            cls.cursor.execute(query, (user_id,))
            result = cls.cursor.fetchone()

            if result:
                user_data = dict(result)
                user_data.setdefault("isAuth", False)
                user_data["password"] = "[PROTECTED]"
                return User(**user_data)
            return None
        finally:
            cls.close()
