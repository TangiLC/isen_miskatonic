from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
from typing import Any, Dict, List

from models.user import User, UserRole
from services.csv_import_service import CSVImportService
from utils.auth_dependencies import get_current_user
from schemas.question import (
    AnswerCheckResponse,
    CSVImportResponse,
    QuestionCreate,
    QuestionResponse,
    QuestionUpdate,
)
from services.question_service import QuestionService

router = APIRouter()
question_service = QuestionService()
csv_import_service = CSVImportService()


@router.put(
    "/api/question",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une nouvelle question",
    description="Crée une nouvelle question à partir des données JSON fournies. Route sécurisée JWT.",
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
    current_user: User = Depends(get_current_user),
) -> QuestionResponse:
    try:
        user_id = current_user.id
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token JWT invalide - ID utilisateur manquant",
            )
        if isinstance(user_id, str) and user_id.isdigit():
            user_id = int(user_id)

        q = await question_service.create_question(question_data, user_id)

        return QuestionResponse(
            id=q.id,
            question=q.question,
            subject=q.subject,
            use=q.use,
            corrects=q.corrects,
            responses=q.responses,
            remark=q.remark,
            status=q.status,
            created_by=q.created_by,
            created_at=q.created_at,
            edited_at=q.edited_at,
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
    description="""Retourne la question correspondant à l'id.
    Les réponses correctes ne sont visibles que pour les rôles définis. Route sécurisée JWT.""",
    responses={
        200: {"description": "Question trouvée", "model": QuestionResponse},
        400: {"description": "ID invalide"},
        401: {"description": "Token d'authentification requis"},
        404: {"description": "Question introuvable"},
        500: {"description": "Erreur interne"},
    },
    tags=["Questions"],
)
async def get_question(
    id: str = Path(..., description="Identifiant MongoDB de la question"),
    current_user: User = Depends(get_current_user),
) -> QuestionResponse:
    try:
        user_role = (current_user.role).upper()
        q = await question_service.get_question_by_id(id)

        visible_corrects = []
        if user_role in ["TEACHER", "ADMIN"]:
            visible_corrects = q.corrects

        return QuestionResponse(
            id=q.id,
            question=q.question,
            subject=q.subject,
            use=q.use,
            corrects=visible_corrects,
            responses=q.responses or [],
            remark=q.remark,
            status=q.status or "draft",
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


@router.get(
    "/api/questions",
    response_model=List[QuestionResponse],
    status_code=status.HTTP_200_OK,
    summary="Lister toutes les questions",
    description="""Retourne l'ensemble des questions stockées en base. 
    Les réponses correctes ne sont visibles que pour les rôles définis. Route sécurisée JWT.""",
    responses={
        200: {"description": "Liste renvoyée avec succès"},
        401: {"description": "Token d'authentification requis"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questions"],
)
async def get_questions(
    current_user: User = Depends(get_current_user),
) -> List[QuestionResponse]:
    try:
        user_role = (current_user.role).upper()
        items = await question_service.get_all_questions()
        results: List[QuestionResponse] = []
        for q in items:
            visible_corrects = []
            if user_role in ["TEACHER", "ADMIN"]:
                visible_corrects = q.corrects
            results.append(
                QuestionResponse(
                    id=q.id,
                    question=q.question,
                    subject=q.subject,
                    use=q.use,
                    corrects=visible_corrects,
                    responses=q.responses or [],
                    remark=q.remark,
                    status=q.status,
                    created_by=q.created_by,
                    created_at=q.created_at,
                    edited_at=q.edited_at,
                )
            )
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des questions: {e}",
        )


@router.get(
    "/api/questions/subjects",
    response_model=List[str],
    status_code=status.HTTP_200_OK,
    summary="Lister les sujets",
    description="Retourne la liste distincte des sujets présents dans les questions.",
    responses={
        200: {"description": "Liste des sujets renvoyée avec succès."},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questions"],
)
async def get_subjects() -> List[str]:
    try:
        return await question_service.get_subjects()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des sujets: {e}",
        )


@router.get(
    "/api/questions/uses",
    response_model=List[str],
    status_code=status.HTTP_200_OK,
    summary="Lister les usages",
    description="Retourne la liste distincte des 'use' présentes dans les questions.",
    responses={
        200: {"description": "Liste des usages renvoyée avec succès."},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questions"],
)
async def get_uses() -> List[str]:
    try:
        return await question_service.get_uses()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des usages: {e}",
        )


@router.get(
    "/api/questions/subjects/{subject_name}",
    response_model=List[QuestionResponse],
    status_code=status.HTTP_200_OK,
    summary="Lister les questions par sujet",
    description="Retourne les questions dont au moins un sujet contient {subject_name} (recherche insensible à la casse). Route sécurisée JWT.",
    responses={
        200: {"description": "Liste renvoyée avec succès"},
        401: {"description": "Token d'authentification requis"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questions"],
)
async def get_questions_by_subject_name(
    subject_name: str = Path(
        ..., description="Sous-chaîne à rechercher dans les sujets"
    ),
    limit: int = Query(50, ge=1, le=200, description="Nombre maximum de résultats"),
    current_user: User = Depends(get_current_user),
) -> List[QuestionResponse]:
    try:
        user_role = (current_user.role).upper()
        items = await question_service.get_questions_by_subject_contains(
            subject_name, limit
        )
        results: List[QuestionResponse] = []
        for q in items:
            visible_corrects = []
            if user_role in ["TEACHER", "ADMIN"]:
                visible_corrects = q.corrects
            results.append(
                QuestionResponse(
                    id=q.id,
                    question=q.question,
                    subject=q.subject,
                    use=q.use,
                    corrects=visible_corrects,
                    responses=q.responses or [],
                    remark=q.remark,
                    status=q.status or "draft",
                    created_by=q.created_by,
                    created_at=q.created_at,
                    edited_at=q.edited_at,
                )
            )
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la recherche par sujet: {e}",
        )


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
    current_user: User = Depends(get_current_user),
) -> QuestionResponse:
    try:
        user_id = current_user.id
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token JWT invalide - ID utilisateur manquant",
            )
        if isinstance(user_id, str) and user_id.isdigit():
            user_id = int(user_id)

        updated = await question_service.update_question(id, question_data, user_id)

        return QuestionResponse(
            id=updated.id,
            question=updated.question,
            subject=updated.subject,
            use=updated.use,
            corrects=updated.corrects,
            responses=updated.responses,
            remark=updated.remark,
            status=updated.status,
            created_by=updated.created_by,
            created_at=updated.created_at,
            edited_at=updated.edited_at,
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


@router.put(
    "/api/questions/from_csv",
    response_model=CSVImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Importer des questions depuis un fichier CSV",
    description="""
    Importe des questions en masse depuis un fichier CSV.
    Le CSV doit contenir les colonnes: question, subject, use, correct, responseA, responseB, responseC, responseD, remark.
    Fusionne automatiquement les questions identiques et corrige les sujets similaires.
    Route sécurisée JWT - seuls TEACHER et ADMIN peuvent importer.
    """,
    responses={
        201: {"description": "Import réussi", "model": CSVImportResponse},
        400: {"description": "Fichier CSV invalide ou données incorrectes"},
        401: {"description": "Token d'authentification requis"},
        403: {"description": "Accès refusé - rôle insuffisant"},
        413: {"description": "Fichier trop volumineux"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questions"],
)
async def import_csv(
    file: UploadFile = File(..., description="Fichier CSV à importer (max 10MB)"),
    fix_subjects: bool = True,
    subject_threshold: float = 0.90,
    current_user: User = Depends(get_current_user),
) -> CSVImportResponse:
    """Importe des questions depuis un fichier CSV"""
    try:
        # Vérification des permissions - Accès direct aux propriétés de l'objet User
        if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seuls les enseignants et administrateurs peuvent importer des questions",
            )

        # Récupération de l'ID utilisateur
        if not current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token JWT invalide - ID utilisateur manquant",
            )

        user_id = current_user.id
        # Conversion en int si nécessaire
        if isinstance(user_id, str) and user_id.isdigit():
            user_id = int(user_id)

        # Import via le service
        return await csv_import_service.import_questions_from_csv(
            file=file,
            user_id=user_id,
            fix_subjects=fix_subjects,
            subject_threshold=subject_threshold,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'import CSV: {str(e)}",
        )
