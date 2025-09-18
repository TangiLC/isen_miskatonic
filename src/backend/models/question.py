from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class Question(BaseModel):
    id: Optional[str] = None
    question: str
    subject: List[str] = []
    use: List[str] = []
    corrects: List[str] = []
    responses: List[str] = []
    remark: Optional[str] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None
