from typing import Optional
from pydantic import BaseModel, EmailStr
from enum import Enum


class UserRole(str, Enum):
    """Énumération des rôles utilisateur"""

    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"
    USER = "user"


class User(BaseModel):
    """
    Modèle interne d'utilisateur (côté service/domaine).
    Pas de persistance pour le moment.
    """

    id: Optional[int] = None
    name: str
    email: Optional[EmailStr] = None
    role: UserRole = UserRole.USER
    password: str
    isAuth: Optional[bool] = False
