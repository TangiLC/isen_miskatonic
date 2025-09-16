from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from typing import Any, Dict, List, Optional

from utils.auth_dependencies import get_current_user
from schemas.question import QuestionCreate, QuestionResponse, QuestionUpdate
from services.question_service import QuestionService

router = APIRouter()
question_service = QuestionService()


@router.put(
    "/api/question",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une nouvelle question",
    description="Crée une nouvelle question à partir des données JSON fournies. Route Sécurisée JWT",
    responses={
        201: {"description": "Question créée avec succès", "model": QuestionResponse},
        400: {"description": "Données invalides"},
        401: {"description": "Token d'authentification requis"},
        409: {"description": "Conflit - Erreur lors de l'insertion"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questions"],
)
async def create_question(
    question_data: QuestionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> QuestionResponse:
    """
    Créer une nouvelle question.

    Récupère les données JSON depuis le body de la requête, instancie une nouvelle Question,
    complète la date de création avec l'heure actuelle, puis l'insère en base de données MongoDB.
    L'ID sera automatiquement généré par MongoDB.
    Args:
        question_data (QuestionCreate): Données de la question à créer
        current_user : utilisateur authentifié JWT
    Returns:
        QuestionResponse: La question créée avec l'ID généré automatiquement
    Raises:
        HTTPException:
            - 400 si les données sont invalides
            - 401 erreur d'authentification
            - 409 en cas d'erreur lors de l'insertion
            - 500 en cas d'erreur interne
    """
    try:
        user_id = current_user.get("uid")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token JWT invalide - ID utilisateur manquant",
            )
        if isinstance(user_id, str) and user_id.isdigit():
            user_id = int(user_id)

        question = await question_service.create_question(question_data, user_id)

        return QuestionResponse(
            id=question.id,
            question=question.question,
            subject=question.subject,
            use=question.use,
            correct=question.correct,
            responseA=question.responseA,
            responseB=question.responseB,
            responseC=question.responseC,
            responseD=question.responseD,
            remark=question.remark,
            created_by=question.created_by,
            created_at=question.created_at,
            edited_at=question.edited_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Données de question invalides: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création de la question: {str(e)}",
        )


################################################################################
@router.get(
    "/api/question/{id}",
    response_model=QuestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer une question par ID",
    description="Retourne la question correspondant à l'identifiant fourni en query string",
    responses={
        200: {"description": "Question trouvée", "model": QuestionResponse},
        400: {"description": "ID invalide"},
        404: {"description": "Question introuvable"},
        418: {"description": "Question bouillante"},
        500: {"description": "Erreur interne"},
    },
    tags=["Questions"],
)
async def get_question(
    id: str = Path(..., description="Identifiant MongoDB de la question")
) -> QuestionResponse:
    try:
        q = await question_service.get_question_by_id(id)
        return QuestionResponse(
            id=q.id,
            question=q.question,
            subject=q.subject,
            use=q.use,
            correct=q.correct or [],
            responseA=q.responseA,
            responseB=q.responseB,
            responseC=q.responseC,
            responseD=q.responseD,
            remark=q.remark,
            created_by=q.created_by,
            created_at=q.created_at,
            edited_at=q.edited_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération: {e}",
        )


################################################################################
@router.get(
    "/api/questions",
    response_model=List[QuestionResponse],
    status_code=status.HTTP_200_OK,
    summary="Lister toutes les questions",
    description=("Retourne une liste de l'ensemble des questions enregistrées. "),
    responses={
        200: {
            "description": "Liste de questions renvoyée avec succès.",
            "model": List[QuestionResponse],
        },
        500: {
            "description": "Erreur interne du serveur",
        },
    },
    tags=["Questions"],
)
async def get_all_questions(
    limit: Optional[int] = Query(
        default=None,
        description="Nombre maximum d'éléments à retourner (optionnel).",
        example=100,
    )
) -> List[QuestionResponse]:
    """
    Récupère toutes les questions. Si `limit` est fourni, la taille du résultat peut être restreinte côté service/dépôt.
    """
    try:
        questions = await question_service.get_all_questions()
        if limit is not None:
            questions = questions[: max(limit, 0)]
        return [
            QuestionResponse(
                id=q.id,
                question=q.question,
                subject=q.subject,
                use=q.use,
                correct=q.correct or [],
                responseA=q.responseA,
                responseB=q.responseB,
                responseC=q.responseC,
                responseD=q.responseD,
                remark=q.remark,
                created_by=q.created_by,
                created_at=q.created_at,
                edited_at=q.edited_at,
            )
            for q in questions
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération de toutes les questions: {e}",
        )


################################################################################
@router.get(
    "/api/subjects",
    response_model=List[str],
    status_code=status.HTTP_200_OK,
    summary="Lister les sujets",
    description="Retourne la liste distincte des sujets présents dans les questions.",
    responses={
        200: {
            "description": "Liste des sujets renvoyée avec succès.",
            "model": List[str],
        },
        500: {
            "description": "Erreur interne du serveur",
        },
    },
    tags=["Questions"],
)
async def get_subjects() -> List[str]:
    """
    Récupère la liste distincte des `subject`.
    """
    try:
        return await question_service.get_subjects()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des sujets: {e}",
        )


################################################################################
@router.patch(
    "/api/question/{id}",
    response_model=QuestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Mettre à jour une question",
    description="Met à jour une question existante. Seul le créateur peut modifier sa question.",
    responses={
        200: {
            "description": "Question mise à jour avec succès",
            "model": QuestionResponse,
        },
        400: {"description": "ID invalide ou données invalides"},
        401: {"description": "Token d'authentification requis"},
        403: {"description": "Accès refusé - seul le créateur peut modifier"},
        404: {"description": "Question introuvable"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questions"],
)
async def update_question(
    id: str = Path(..., description="ID de la question à modifier"),
    question_data: QuestionUpdate = ...,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> QuestionResponse:
    """
    Met à jour une question existante.

    Authentification JWT requise. Seul l'utilisateur qui a créé la question peut la modifier.
    L'ID utilisateur est extrait du token JWT et comparé avec le champ created_by de la question.
    """
    try:
        # Extraire l'ID utilisateur du token JWT
        user_id = current_user.get("uid")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token JWT invalide - ID utilisateur manquant",
            )

        # Convertir en int si nécessaire
        if isinstance(user_id, str) and user_id.isdigit():
            user_id = int(user_id)

        # Mettre à jour la question
        updated_question = await question_service.update_question(
            id, question_data, user_id
        )

        return QuestionResponse(
            id=updated_question.id,
            question=updated_question.question,
            subject=updated_question.subject,
            use=updated_question.use,
            correct=updated_question.correct,
            responseA=updated_question.responseA,
            responseB=updated_question.responseB,
            responseC=updated_question.responseC,
            responseD=updated_question.responseD,
            remark=updated_question.remark,
            created_by=updated_question.created_by,
            created_at=updated_question.created_at,
            edited_at=updated_question.edited_at,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la mise à jour: {str(e)}",
        )
