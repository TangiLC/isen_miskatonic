from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from models.user import UserRole


class LoginRequest(BaseModel):
    """Schéma pour la requête de connexion"""

    username: str = Field(..., description="Nom", examples=["bob"])
    password: str = Field(..., description="Mot de passe", examples=["Pass123*"])


class UserCreate(BaseModel):
    """Schéma pour la création d'un utilisateur"""

    id: Optional[int] = Field(
        None, description="ID utilisateur (auto-généré si non fourni)"
    )
    name: str = Field(..., description="Nom 'utilisateur", examples=["Bob"])
    email: EmailStr = Field(
        ..., description="Adresse email", examples=["bob@example.com"]
    )
    password: str = Field(
        ...,
        description="Mot de passe (sera haché automatiquement)",
        examples=["Pass123*"],
    )
    role: UserRole = Field(
        default=UserRole.USER,
        description="Rôle de l'utilisateur",
        examples=["user"],
    )


class UserResponse(BaseModel):
    """Schéma pour la réponse utilisateur (sans mot de passe)"""

    id: int = Field(..., description="ID unique de l'utilisateur")
    name: str = Field(..., description="Nom complet de l'utilisateur")
    email: EmailStr = Field(..., description="Adresse email")
    role: UserRole = Field(..., description="Rôle de l'utilisateur")


class TokenResponse(BaseModel):
    """Schéma pour la réponse contenant un token JWT"""

    access_token: str = Field(
        ...,
        description="Token JWT pour l'authentification",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
    )
    token_type: str = Field(
        default="bearer", description="Type de token", examples=["bearer"]
    )
    user: UserResponse = Field(..., description="Informations de l'utilisateur")


class TokenValidationResponse(BaseModel):
    """Schéma pour la validation d'un token"""

    valid: bool = Field(..., description="Indique si le token est valide")
    user: Optional[UserResponse] = Field(
        None, description="Informations utilisateur si le token est valide"
    )
    message: Optional[str] = Field(
        None, description="Message d'erreur si le token est invalide"
    )
