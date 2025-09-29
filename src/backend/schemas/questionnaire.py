from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from models.questionnaire import QuestionnaireStatus


class QuestionnaireCreate(BaseModel):
    """
    Schéma d'entrée pour la création d'un questionnaire.
    """

    title: str = Field(..., description="Titre du questionnaire.")
    subject: Optional[List[str]] = Field(
        default=[], description="Sujets du questionnaire (tags)."
    )
    use: Optional[List[str]] = Field(default=[], description="Contextes d'utilisation.")
    questions: List[str] = Field(
        default=[], description="Liste des IDs des questions du questionnaire."
    )
    remark: Optional[str] = Field(None, description="Remarque ou commentaire.")
    status: Optional[QuestionnaireStatus] = Field(
        None, description="Statut du questionnaire (draft/active/archive)"
    )


class QuestionnaireResponse(BaseModel):
    """
    Schéma de sortie renvoyé par l'API pour un questionnaire.
    """

    id: str = Field(..., description="Identifiant MongoDB généré automatiquement.")
    title: str = Field(..., description="Titre du questionnaire.")
    subject: Optional[List[str]] = Field(
        default=[], description="Sujets du questionnaire (tags)."
    )
    use: Optional[List[str]] = Field(default=[], description="Contextes d'utilisation.")
    questions: List[str] = Field(
        default=[], description="Liste des IDs des questions du questionnaire."
    )
    remark: Optional[str] = Field(None, description="Remarque ou commentaire.")
    status: Optional[QuestionnaireStatus] = Field(
        None, description="Statut du questionnaire (draft/active/archive)"
    )
    created_by: Optional[int] = Field(None, description="Identifiant du créateur.")
    created_at: Optional[datetime] = Field(None, description="Date de création")
    edited_at: Optional[datetime] = Field(None, description="Date de modification")


class QuestionnaireUpdate(BaseModel):
    """
    Schéma d'entrée pour la mise à jour partielle d'un questionnaire.
    Tous les champs sont optionnels.
    """

    title: Optional[str] = Field(None, description="Titre du questionnaire.")
    subject: Optional[List[str]] = Field(
        None, description="Sujets du questionnaire (tags)."
    )
    use: Optional[List[str]] = Field(None, description="Contextes d'utilisation.")
    questions: Optional[List[str]] = Field(
        None, description="Liste des IDs des questions du questionnaire."
    )
    remark: Optional[str] = Field(None, description="Remarque ou commentaire.")
    status: Optional[QuestionnaireStatus] = Field(
        None, description="Statut du questionnaire (draft/active/archive)"
    )
