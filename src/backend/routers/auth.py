from fastapi import APIRouter, Depends, HTTPException, status
from models.user import User
from utils.auth_dependencies import get_current_user, hide_email
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
        200: {"description": "Succès authentification, retour token JWT."},
        422: {"description": "Erreur de validation des données"},
        500: {"description": "Erreur interne du serveur"},
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
    "/auth/whoami/",
    summary="Vérifier du user depuis son token JWT",
    description="Vérifie la validité du JWT (Authorization: Bearer) et retourne les informations utilisateur.",
    responses={
        200: {"description": "Token valide", "model": User},
        401: {"description": "Token invalide, expiré ou manquant"},
    },
    tags=["Auth"],
)
async def whoami(current_user: User = Depends(get_current_user)):
    """
    Retourne les informations de l'utilisateur courant si le JWT est valide.
    """
    who_am_i = current_user.model_dump()
    who_am_i["email"] = hide_email(current_user.email)
    who_am_i["password"] = "*****"

    return who_am_i
