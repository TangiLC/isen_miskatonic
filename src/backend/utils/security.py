from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from dotenv import load_dotenv
import os
import jwt

load_dotenv()

# Configuration JWT
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-unsafe-secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MIN", "60"))


def create_access_token(
    subject: str,
    claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Crée un JWT signé HS256.

    Args:
        subject: une chaîne unique (ex: user_id ou email)
        claims: claims additionnels (id, name, email, role, etc.)
        expires_delta: durée de validité personnalisée

    Returns:
        str: Token JWT encodé
    """
    to_encode: Dict[str, Any] = {}
    if claims:
        to_encode.update(claims)

    now = datetime.now(timezone.utc)
    exp = now + (expires_delta or timedelta(minutes=JWT_EXPIRE_MIN))

    # Claims standards JWT
    to_encode.update(
        {"sub": subject, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    )

    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Vérifie et décode un JWT.

    Args:
        token: Token JWT à vérifier

    Returns:
        Dict contenant les claims du token ou None si invalide
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None
