from fastapi import APIRouter, HTTPException, status
from schemas.user import UserCreate, TokenResponse
from services.auth_service import AuthService

router = APIRouter()
auth_service = AuthService()


@router.post(  ############# MODE DEV UNIQUEMENT - SUPPRIMER EN PROD !!!
    "/auth/testjwt/",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Générer un JWT de test  /!\ Mode Dev Test uniquement /!\ ",
    description="Génère un token JWT sans accès BDD, à partir d'un body JSON {id, name, email, role}.",
    responses={
        200: {
            "description": "Succès authentification, retour token JWT.",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                        "token_type": "bearer",
                        "user": {
                            "id": "123e4567-e89b-12d3-a456-426614174000",
                            "name": "John Doe",
                            "email": "john@example.com",
                            "role": "user",
                        },
                    }
                }
            },
        },
        422: {
            "description": "Erreur de validation des données",
        },
        500: {
            "description": "Erreur interne du serveur",
        },
    },
    tags=["Auth"],
)
async def create_test_jwt(payload: UserCreate) -> TokenResponse:
    """
    Crée un token JWT de test sans authentification réelle.
    Utile pour le développement et les tests.
    """
    try:
        return await auth_service.create_test_token(payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création du token: {str(e)}",
        )


# Endpoint bonus pour vérifier un token
@router.get(
    "/auth/verify/",
    summary="Vérifier un token JWT",
    description="Vérifie la validité d'un token JWT et retourne les informations utilisateur.",
    responses={
        200: {"description": "Token valide"},
        401: {"description": "Token invalide ou expiré"},
    },
    tags=["Auth"],
)
async def verify_jwt_token(token: str):
    """
    Vérifie la validité d'un token JWT.
    """
    from utils.security import verify_token

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré"
        )

    return {
        "valid": True,
        "user_id": payload.get("uid"),
        "email": payload.get("email"),
        "name": payload.get("name"),
        "role": payload.get("role"),
        "expires_at": payload.get("exp"),
    }
