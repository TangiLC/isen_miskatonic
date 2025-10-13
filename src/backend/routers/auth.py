from fastapi import APIRouter, Depends, HTTPException, status
from models.user import User
from utils.auth_dependencies import get_current_user, hide_email
from schemas.user import (
    LoginRequest,
    UserCreate,
    UserResponse,
    TokenResponse,
    TokenValidationResponse,
)
from services.auth_service import AuthService

router = APIRouter()
auth_service = AuthService()


@router.post(
    "/api/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouveau compte utilisateur",
    description="""
    Crée un nouveau compte utilisateur avec email, nom et mot de passe.
    Le mot de passe est automatiquement haché avec bcrypt.
    Retourne un token JWT pour connexion automatique après inscription.
    """,
    responses={
        201: {
            "description": "Compte créé avec succès",
            "model": TokenResponse,
        },
        400: {"description": "Données invalides ou email déjà utilisé"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Auth"],
)
async def register(user_data: UserCreate) -> TokenResponse:
    """Crée un nouveau compte utilisateur"""
    try:
        if not user_data.name or not user_data.email or not user_data.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nom, email et mot de passe sont requis",
            )

        result = await AuthService.register(user_data)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email déjà utilisé ou erreur lors de la création",
            )

        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Données invalides: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création du compte: {str(e)}",
        )


@router.post(
    "/api/auth/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Se connecter",
    description="""
    Authentifie un utilisateur avec son nom d'utilisateur et mot de passe.
    Vérifie le mot de passe haché en base de données avec bcrypt.
    Retourne un token JWT valide 60 minutes.
    """,
    responses={
        200: {"description": "Authentification réussie", "model": TokenResponse},
        401: {"description": "Identifiants incorrects"},
        400: {"description": "Données manquantes"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Auth"],
)
async def login(credentials: LoginRequest) -> TokenResponse:
    """Authentifie un utilisateur et retourne un token JWT"""
    try:
        if not credentials.username or not credentials.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nom d'utilisateur et mot de passe requis",
            )

        user, token = await AuthService.login(
            credentials.username, credentials.password
        )

        if not user or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nom d'utilisateur ou mot de passe incorrect",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return TokenResponse(
            access_token=token,
            user=UserResponse(
                id=user.id, name=user.name, email=user.email, role=user.role
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'authentification: {str(e)}",
        )


@router.get(
    "/api/auth/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer l'utilisateur courant",
    description="""
    Retourne les informations de l'utilisateur authentifié à partir du token JWT.
    Nécessite un token valide dans le header Authorization.
    Route sécurisée JWT.
    """,
    responses={
        200: {
            "description": "Informations utilisateur retournées",
            "model": UserResponse,
        },
        401: {"description": "Token manquant ou invalide"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Auth"],
)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Retourne les informations de l'utilisateur actuellement connecté"""
    try:
        return UserResponse(
            id=current_user.id,
            name=current_user.name,
            email=current_user.email,
            role=current_user.role,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des informations: {str(e)}",
        )


@router.post(
    "/api/auth/validate-token",
    response_model=TokenValidationResponse,
    status_code=status.HTTP_200_OK,
    summary="Valider un token JWT",
    description="""
    Vérifie la validité d'un token JWT (signature, expiration).
    Retourne les informations de l'utilisateur si le token est valide.
    Utile pour vérifier un token côté frontend.
    """,
    responses={
        200: {"description": "Token valide", "model": TokenValidationResponse},
        401: {"description": "Token invalide ou expiré"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Auth"],
)
async def validate_token(
    current_user: User = Depends(get_current_user),
) -> TokenValidationResponse:
    """Valide un token JWT et retourne son contenu"""
    try:
        return TokenValidationResponse(
            valid=True,
            user=UserResponse(
                id=current_user.id,
                name=current_user.name,
                email=current_user.email,
                role=current_user.role,
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la validation: {str(e)}",
        )


@router.get(
    "/api/auth/users/{user_id}/name",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Récupérer le nom d'un utilisateur",
    description="""
    Retourne le nom d'un utilisateur à partir de son ID.
    Utile pour afficher les noms des créateurs de questions.
    Route sécurisée JWT.
    """,
    responses={
        200: {"description": "Nom de l'utilisateur retourné"},
        401: {"description": "Token d'authentification requis"},
        404: {"description": "Utilisateur introuvable"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Auth"],
)
async def get_user_name(
    user_id: int,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Récupère le nom d'un utilisateur par son ID"""
    try:
        user_name = await AuthService.get_user_name(user_id)

        if user_name == "Inconnu":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Utilisateur avec l'ID {user_id} introuvable",
            )

        return {"userName": user_name}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération du nom: {str(e)}",
        )


# ============================================================================
# ENDPOINTS DE DÉVELOPPEMENT - À SUPPRIMER EN PRODUCTION
# ============================================================================


@router.post(
    "/api/auth/test-token",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="/!\\ DEV ONLY - Générer un token de test (sans BDD)",
    description="""
    Génère un token JWT pour les tests sans vérification en base de données.
    /!\\ À utiliser uniquement en développement !
    Le token contient un claim "scope": "test" pour l'identifier.
    """,
    responses={
        201: {"description": "Token de test généré", "model": TokenResponse},
        400: {"description": "Données invalides"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Auth"],
)
async def create_test_token(payload: UserCreate) -> TokenResponse:
    """Crée un token JWT de test sans interaction avec la BDD"""
    try:
        if not payload.name or not payload.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nom et email requis pour générer un token de test",
            )

        return await AuthService.create_test_token(payload)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Données invalides: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération du token: {str(e)}",
        )


@router.get(
    "/auth/whoami/",
    summary="/!\\ DEV ONLY - Vérifier du user depuis son token JWT",
    description="Vérifie la validité du JWT (Authorization: Bearer) et retourne les informations utilisateur.",
    responses={
        200: {"description": "Token valide", "model": User},
        401: {"description": "Token invalide, expiré ou manquant"},
    },
    tags=["Auth"],
)
async def whoami(current_user: User = Depends(get_current_user)):
    """Retourne les informations de l'utilisateur courant si le JWT est valide"""
    who_am_i = current_user.model_dump()
    who_am_i["email"] = hide_email(current_user.email)
    who_am_i["password"] = "*****"

    return who_am_i
