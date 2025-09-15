from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class QuestionCreate(BaseModel):
    """
    Schema pour la création d'une nouvelle question.
    """

    # _id: str = Field(..., description="Identifiant unique (MongoDB) de la question")
    question: str = Field(..., description="Intitulé de la question")
    subject: str = Field(..., description="Sujet de la question")
    use: str = Field(..., description="Contexte de la question")
    correct: List[str] = Field(..., description="Liste des réponses correctes")
    responseA: Optional[str] = Field(None, description="Réponse A")
    responseB: Optional[str] = Field(None, description="Réponse B")
    responseC: Optional[str] = Field(None, description="Réponse C")
    responseD: Optional[str] = Field(None, description="La Réponse D")
    remark: Optional[str] = Field(None, description="Remarque ou commentaire")
    created_by: Optional[int] = Field(None, description="ID du créateur")


class QuestionResponse(BaseModel):
    """
    Schema pour la réponse après création d'une question.
    """

    id: str = Field(..., description="ID généré automatiquement par MongoDB")
    question: str
    subject: str
    use: str
    correct: List[str]
    responseA: Optional[str] = None
    responseB: Optional[str] = None
    responseC: Optional[str] = None
    responseD: Optional[str] = None
    remark: Optional[str] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
