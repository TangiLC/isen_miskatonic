from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


class QuestionStatus(str, Enum):
    """Énumération des statuts questions"""

    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVE = "archive"


class Question(BaseModel):
    id: Optional[str] = None
    question: str
    subject: List[str] = []
    use: List[str] = []
    corrects: List[str] = []
    responses: List[str] = []
    remark: Optional[str] = None
    status: Optional[QuestionStatus] = QuestionStatus.DRAFT
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None
