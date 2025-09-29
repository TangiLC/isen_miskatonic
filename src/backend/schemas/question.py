from typing import Dict, List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from models.question import QuestionStatus


class QuestionCreate(BaseModel):
    """
    Schéma d'entrée pour la création d'une question.
    """

    question: str = Field(..., description="Intitulé de la question.")
    subject: List[str] = Field(..., description="sujets de la question (tags).")
    use: List[str] = Field(..., description="contextes d'utilisation")
    corrects: List[str] = Field(..., description="Liste des réponses correctes.")
    responses: List[str] = Field(..., description="Liste des propositions de réponse.")
    remark: Optional[str] = Field(None, description="Remarque ou commentaire.")
    status: Optional[QuestionStatus] = Field(
        None, description="Statut de la question (draft/active/archive)"
    )


class QuestionResponse(BaseModel):
    """
    Schéma de sortie renvoyé par l'API pour une question.
    """

    id: str = Field(..., description="Identifiant MongoDB généré automatiquement.")
    question: str = Field(..., description="Intitulé de la question.")
    subject: List[str] = Field(..., description="sujets de la question (tags).")
    use: List[str] = Field(..., description="contextes d'utilisation")
    corrects: List[str] = Field(..., description="Liste des réponses correctes.")
    responses: List[str] = Field(..., description="Liste des propositions de réponse.")
    remark: Optional[str] = Field(None, description="Remarque ou commentaire.")
    status: Optional[QuestionStatus] = Field(
        None, description="Statut de la question (draft/active/archive)"
    )
    created_by: Optional[int] = Field(None, description="Identifiant du créateur.")
    created_at: Optional[datetime] = Field(None, description="Date de création")
    edited_at: Optional[datetime] = Field(None, description="Date de modification")


class QuestionUpdate(BaseModel):
    """
    Schéma d'entrée pour la mise à jour partielle d'une question.
    Tous les champs sont optionnels.
    """

    question: Optional[str] = Field(None, description="Intitulé de la question.")
    subject: Optional[List[str]] = Field(
        None, description="sujets de la question (tags)."
    )
    use: Optional[List[str]] = Field(None, description="contextes d'utilisation")
    corrects: Optional[List[str]] = Field(
        None, description="Liste des réponses correctes."
    )
    responses: Optional[List[str]] = Field(
        None, description="Liste des propositions de réponse."
    )
    remark: Optional[str] = Field(None, description="Remarque ou commentaire.")
    status: Optional[QuestionStatus] = Field(
        None, description="Statut de la question (draft/active/archive)"
    )


class AnswerCheckResponse(BaseModel):
    """
    Réponse renvoyée par l'API lors de la vérification d'une/plusieurs réponses.
    Ne contient que des compteurs entiers.
    """

    expected_good: int = Field(
        ..., ge=0, description="Total de bonnes réponses attendues."
    )
    sent_good: int = Field(..., ge=0, description="Total de bonnes réponses envoyées.")
    sent_bad: int = Field(
        ..., ge=0, description="Total de mauvaises réponses envoyées."
    )
    corrects: Optional[List[str]] = Field(
        None,
        description="Liste des réponses correctes (si show_correct=true).",
    )


class CSVImportResponse(BaseModel):
    """Réponse de l'import CSV"""

    success: bool
    imported: int
    errors: int
    merged: int
    error_details: List[Dict[str, str]]
    message: str


class CSVImportStats(BaseModel):
    """Statistiques de l'import"""

    total_rows: int
    valid_questions: int
    merged_questions: int
    subject_corrections: int
