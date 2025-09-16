from typing import Optional
from pydantic import BaseModel, EmailStr
from enum import Enum


class UserRole(str, Enum):
    """Énumération des rôles utilisateur"""

    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"


class User(BaseModel):
    """
    Modèle interne d'utilisateur (côté service/domaine).
    Pas de persistance pour le moment.
    """

    id: Optional[str] = None
    name: str
    email: EmailStr
    role: UserRole = UserRole.TEACHER
    password: Optional[str] = None
