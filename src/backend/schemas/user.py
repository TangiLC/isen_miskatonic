from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from models.user import UserRole


class UserCreate(BaseModel):
    """
    Payload de test pour /auth/testjwt/ (pas de BDD).
    """

    id: Optional[int] = Field(None, description="Identifiant technique (optionnel)")
    name: str = Field(..., description="Nom de l'utilisateur")
    email: EmailStr = Field(..., description="Email de l'utilisateur")
    role: Optional[UserRole] = Field(
        UserRole.TEACHER, description="Rôle de l'utilisateur"
    )


class UserResponse(BaseModel):
    """
    DTO exposé par l'API (sans password).
    """

    id: Optional[int] = None
    name: str
    email: EmailStr
    role: UserRole


class TokenResponse(BaseModel):
    """
    Réponse d'un endpoint qui renvoie un JWT.
    """

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
