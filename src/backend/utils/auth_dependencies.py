from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.user import User
from utils.security import verify_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """
    Vérifie le token JWT et retourne les informations utilisateur.
    Args:
        credentials: Credentials JWT du header Authorization
    Returns:
        Objet User
    Raises:
        HTTPException: Si le token est invalide
    """
    token = credentials.credentials
    payload = verify_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return User(**payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Données utilisateur invalides dans le token ({exc})",
        )


def hide_email(email: str) -> str:
    """
    Masque partiellement une adresse email.
    """
    try:
        local, domain = email.split("@")
        dom, ext = domain.rsplit(".", 1)

        local_mask = "*" * max(len(local) - 3, 0)
        dom_mask = "*" * max(len(dom) - 2, 0)
        ext_mask = "*" * max(len(ext) - 1, 0)
        return f"{local[:2]}{local_mask}{local[-1]}@{dom[:2]}{dom_mask}.{ext[:1]}{ext_mask}"
    except Exception:
        return "***@***"
