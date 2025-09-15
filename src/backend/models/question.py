from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class Question(BaseModel):
    """
    Schéma d'une question.
    """

    id: Optional[str] = None  # généré automatiquement par MongoDB
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
