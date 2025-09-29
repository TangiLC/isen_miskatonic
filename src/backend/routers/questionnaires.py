from typing import List
from fastapi import APIRouter, Depends, HTTPException, Path, status

from models.user import User
from utils.auth_dependencies import get_current_user
from schemas.questionnaire import (
    QuestionnaireCreate,
    QuestionnaireResponse,
    QuestionnaireUpdate,
)
from services.questionnaire_service import QuestionnaireService

router = APIRouter()
questionnaire_service = QuestionnaireService()


@router.put(
    "/api/questionnaire",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouveau questionnaire",
    description="Crée un nouveau questionnaire à partir des données JSON fournies. Route sécurisée JWT.",
    responses={
        201: {
            "description": "Questionnaire créé avec succès",
            "model": QuestionnaireResponse,
        },
        400: {"description": "Données invalides"},
        401: {"description": "Token d'authentification requis"},
        409: {"description": "Conflit - Erreur lors de l'insertion"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questionnaires"],
)
async def create_questionnaire(
    questionnaire_data: QuestionnaireCreate,
    current_user: User = Depends(get_current_user),
) -> QuestionnaireResponse:
    try:
        user_id = current_user.id
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token JWT invalide - ID utilisateur manquant",
            )
        if isinstance(user_id, str) and user_id.isdigit():
            user_id = int(user_id)

        q = await questionnaire_service.create_questionnaire(
            questionnaire_data, user_id
        )

        return QuestionnaireResponse(
            id=q.id,
            title=q.title,
            subject=q.subject,
            use=q.use,
            questions=q.questions,
            remark=q.remark,
            status=q.status,
            created_by=q.created_by,
            created_at=q.created_at,
            edited_at=q.edited_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Données de questionnaire invalides: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création du questionnaire: {str(e)}",
        )


@router.get(
    "/api/questionnaire/{id}",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer un questionnaire par ID",
    description="Retourne le questionnaire correspondant à l'id. Route sécurisée JWT.",
    responses={
        200: {"description": "Questionnaire trouvé", "model": QuestionnaireResponse},
        400: {"description": "ID invalide"},
        401: {"description": "Token d'authentification requis"},
        404: {"description": "Questionnaire introuvable"},
        500: {"description": "Erreur interne"},
    },
    tags=["Questionnaires"],
)
async def get_questionnaire(
    id: str = Path(..., description="Identifiant MongoDB du questionnaire"),
    current_user: User = Depends(get_current_user),
) -> QuestionnaireResponse:
    try:
        q = await questionnaire_service.get_questionnaire_by_id(id)

        return QuestionnaireResponse(
            id=q.id,
            title=q.title,
            subject=q.subject,
            use=q.use,
            questions=q.questions,
            remark=q.remark,
            status=q.status,
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


@router.patch(
    "/api/questionnaire/{id}",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_200_OK,
    summary="Mettre à jour un questionnaire",
    description="Met à jour un questionnaire existant. Seul le créateur peut modifier son questionnaire.",
    responses={
        200: {
            "description": "Questionnaire mis à jour avec succès",
            "model": QuestionnaireResponse,
        },
        400: {"description": "ID invalide ou données invalides"},
        401: {"description": "Token d'authentification requis"},
        403: {"description": "Accès refusé - seul le créateur peut modifier"},
        404: {"description": "Questionnaire introuvable"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questionnaires"],
)
async def update_questionnaire(
    id: str = Path(..., description="ID du questionnaire à modifier"),
    questionnaire_data: QuestionnaireUpdate = ...,
    current_user: User = Depends(get_current_user),
) -> QuestionnaireResponse:
    try:
        user_id = current_user.id
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token JWT invalide - ID utilisateur manquant",
            )
        if isinstance(user_id, str) and user_id.isdigit():
            user_id = int(user_id)

        updated = await questionnaire_service.update_questionnaire(
            id, questionnaire_data, user_id
        )

        return QuestionnaireResponse(
            id=updated.id,
            title=updated.title,
            subject=updated.subject,
            use=updated.use,
            questions=updated.questions,
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


@router.get(
    "/api/questionnaires",
    response_model=List[QuestionnaireResponse],
    status_code=status.HTTP_200_OK,
    summary="Lister tous les questionnaires",
    description="Retourne l'ensemble des questionnaires stockés en base. Route sécurisée JWT.",
    responses={
        200: {"description": "Liste renvoyée avec succès"},
        401: {"description": "Token d'authentification requis"},
        500: {"description": "Erreur interne du serveur"},
    },
    tags=["Questionnaires"],
)
async def get_questionnaires(
    current_user: User = Depends(get_current_user),
) -> List[QuestionnaireResponse]:
    try:
        items = await questionnaire_service.get_all_questionnaires()
        results: List[QuestionnaireResponse] = []
        for q in items:
            results.append(
                QuestionnaireResponse(
                    id=q.id,
                    title=q.title,
                    subject=q.subject,
                    use=q.use,
                    questions=q.questions,
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
            detail=f"Erreur lors de la récupération des questionnaires: {e}",
        )
