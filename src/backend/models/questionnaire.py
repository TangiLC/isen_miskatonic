from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


class QuestionnaireStatus(str, Enum):
    """Énumération des statuts questionnaire"""

    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVE = "archive"


class Questionnaire(BaseModel):
    id: Optional[str] = None
    title: str
    subject: Optional[List[str]] = []
    use: Optional[List[str]] = []
    questions: List[str] = []
    remark: Optional[str] = None
    status: Optional[QuestionnaireStatus] = QuestionnaireStatus.DRAFT
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None
