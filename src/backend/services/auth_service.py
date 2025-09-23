from models.user import User
from schemas.user import UserCreate, UserResponse, TokenResponse
from utils.security import create_access_token
import uuid


class AuthService:
    """
    Service d'authentification "stateless" pour la phase de test.
    """

    async def create_test_token(self, payload: UserCreate) -> TokenResponse:
        """
        Génère un JWT à partir d'un pseudo-user (sans BDD).

        Args:
            payload: Données utilisateur pour créer le token

        Returns:
            TokenResponse: Réponse contenant le token et les infos utilisateur
        """

        user_id = payload.id

        user = User(
            id=user_id,
            name=payload.name,
            email=payload.email,
            role=payload.role,
            password=None,
        )

        # Claims pour le token JWT
        token_claims = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "scope": "test",
        }

        token = create_access_token(
            subject=user.email,  # Utilisation de l'email comme subject principal
            claims=token_claims,
        )

        return TokenResponse(
            access_token=token,
            user=UserResponse(
                id=user.id, name=user.name, email=user.email, role=user.role
            ),
        )
