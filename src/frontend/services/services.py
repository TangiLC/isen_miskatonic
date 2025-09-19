import os
from dotenv import load_dotenv
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from models.user import User
from database.connexion import Connection


load_dotenv()

# Configuration JWT
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-unsafe-secret")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60


class Service(Connection):
    @classmethod
    def create_access_token(
        cls,
        subject: str,
        claims: Optional[Dict[str, Any]] = None,
        expires_delta: Optional[timedelta] = None,
    ) -> str:

        to_encode: Dict[str, Any] = {}
        if claims:
            to_encode.update(claims)
        now = datetime.now(timezone.utc)
        exp = now + (expires_delta or timedelta(minutes=JWT_EXPIRE_MIN))
        to_encode.update(
            {"sub": subject, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
        )
        return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)

    @classmethod
    def authentifier(cls, utilisateur: User) -> Tuple[Optional[User], Optional[str]]:

        try:
            cls.connect()
            # Récupérer l'utilisateur avec son mot de passe haché
            query = """
                SELECT u.*, r.role as role 
                FROM users u 
                LEFT JOIN roles r ON u.role_id = r.id 
                WHERE u.name=?
            """
            cls.cursor.execute(query, (utilisateur.name,))
            result = cls.cursor.fetchone()

            if result:
                # Vérifier le mot de passe avec bcrypt
                stored_password = result["password"]
                if isinstance(stored_password, str):
                    stored_password = stored_password.encode("utf-8")

                if bcrypt.checkpw(
                    utilisateur.password.encode("utf-8"), stored_password
                ):
                    # Mot de passe correct
                    user_data = dict(result)
                    user_data.setdefault("isAuth", True)
                    authenticated_user = User(**user_data)

                    token_claims = {
                        "id": authenticated_user.id,
                        "name": authenticated_user.name,
                        "email": authenticated_user.email,
                        "role": authenticated_user.role.value,
                        # "scope": "test",
                    }

                    token = cls.create_access_token(
                        subject=authenticated_user.email,
                        claims=token_claims,
                    )
                    print("Auth réussie:", authenticated_user.name)

                    return authenticated_user, token
                else:
                    print("Mot de passe incorrect pour:", utilisateur.name)
                    return None, None
            else:
                print("Utilisateur non trouvé:", utilisateur.name)
                return None, None

        except Exception as err:
            print(f"Erreur de connexion BDD: {err}")
            return None, None
        finally:
            cls.close()

    @classmethod
    def create_account(cls, utilisateur: User) -> Optional[User]:

        try:
            cls.connect()
            print("Connexion BDD réussie")

            check_query = """
                SELECT COUNT(*) as count 
                FROM users 
                WHERE email = ?
            """
            cls.cursor.execute(check_query, (utilisateur.email,))
            result = cls.cursor.fetchone()
            print(f"Résultat vérification: {dict(result) if result else ''}")

            if result and result["count"] > 0:
                print(f"Email déjà utilisé: {utilisateur.email}")
                return None

            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(utilisateur.password.encode("utf-8"), salt)
            hashed_password_str = hashed_password.decode("utf-8")

            print("Insertion en BDD...")
            role_query = "SELECT id FROM Roles WHERE role = ?"
            cls.cursor.execute(role_query, ("user",))
            user_role_id = cls.cursor.fetchone()

            if not user_role_id:
                raise RuntimeError("Rôle 'user' introuvable dans la table roles")

            role_id = user_role_id["id"]

            insert_query = """
                INSERT INTO users (name, email, password, role_id)
                VALUES (?, ?, ?, ?)
            """
            cls.cursor.execute(
                insert_query,
                (utilisateur.name, utilisateur.email, hashed_password_str, role_id),
            )

            user_id = cls.cursor.lastrowid
            print(f"ID utilisateur créé: {user_id}")

            cls.connexion.commit()

            select_query = """
                SELECT u.*, r.role as role 
                FROM users u 
                LEFT JOIN roles r ON u.role_id = r.id 
                WHERE u.id = ?
            """
            cls.cursor.execute(select_query, (user_id,))
            user_result = cls.cursor.fetchone()

            if user_result:
                user_data = dict(user_result)
                user_data.setdefault("isAuth", False)
                user_data["password"] = "[PROTECTED]"
                created_user = User(**user_data)

                print(
                    f"Compte créé avec succès: {created_user.name} (ID: {created_user.id})"
                )
                return created_user
            else:
                print("Impossible de récupérer l'utilisateur créé")
                return None

        except Exception as err:

            try:
                if cls.connexion:
                    print("Rollback des changements...")
                    cls.connexion.rollback()

            except Exception as rollback_err:
                print(f"Erreur rollback: {rollback_err}")
            return None
        finally:
            print("Fermeture connexion BDD...")
            cls.close()
