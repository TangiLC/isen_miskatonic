from fastapi import APIRouter, HTTPException, Path, Query, status
from schemas.question import QuestionCreate, QuestionResponse
from services.question_service import QuestionService

router = APIRouter()
question_service = QuestionService()


@router.put(
    "/api/new",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une nouvelle question",
    description="Crée une nouvelle question à partir des données JSON fournies",
    responses={
        201: {"description": "Question créée avec succès", "model": QuestionResponse},
        400: {
            "description": "Données invalides",
            "content": {
                "application/json": {
                    "example": {"detail": "Données de question invalides"}
                }
            },
        },
        409: {
            "description": "Conflit - Erreur lors de l'insertion",
            "content": {
                "application/json": {
                    "example": {"detail": "Erreur de conflit lors de l'insertion"}
                }
            },
        },
        500: {
            "description": "Erreur interne du serveur",
            "content": {
                "application/json": {
                    "example": {"detail": "Erreur lors de la création de la question"}
                }
            },
        },
    },
    tags=["Questions"],
)
async def create_question(question_data: QuestionCreate) -> QuestionResponse:
    """
    Créer une nouvelle question.

    Récupère les données JSON depuis le body de la requête, instancie une nouvelle Question,
    complète la date de création avec l'heure actuelle, puis l'insère en base de données MongoDB.
    L'ID sera automatiquement généré par MongoDB.

    Args:
        question_data (QuestionCreate): Données de la question à créer

    Returns:
        QuestionResponse: La question créée avec l'ID généré automatiquement

    Raises:
        HTTPException:
            - 400 si les données sont invalides
            - 409 en cas d'erreur lors de l'insertion
            - 500 en cas d'erreur interne
    """
    try:
        question = await question_service.create_question(question_data)

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
            correct=q.correct,
            responseA=q.responseA,
            responseB=q.responseB,
            responseC=q.responseC,
            responseD=q.responseD,
            remark=q.remark,
            created_by=q.created_by,
            created_at=q.created_at,
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
