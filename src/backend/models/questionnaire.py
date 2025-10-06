from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


class QuestionnaireStatus(str, Enum):
    """Énumération des statuts questionnaire"""

    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVE = "archive"


class QItem(BaseModel):
    id: str
    question: str
    corrects: Optional[List[str]] = None
    responses: Optional[List[str]] = None
    remark: Optional[str] = None


class QUpdate(BaseModel):
    id: str
    question: str
    subjects: Optional[List[str]] = None
    uses: Optional[List[str]] = None


class Questionnaire(BaseModel):
    id: Optional[str] = None
    title: str
    subjects: Optional[List[str]] = []
    uses: Optional[List[str]] = []
    questions: List[QItem] = []
    remark: Optional[str] = None
    status: Optional[QuestionnaireStatus] = QuestionnaireStatus.DRAFT
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None
