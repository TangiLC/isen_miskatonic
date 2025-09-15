from datetime import datetime
from zoneinfo import ZoneInfo
from models.question import Question
from schemas.question import QuestionCreate
from repositories.question_repository import QuestionRepository


class QuestionService:
    """
    Service pour la gestion des questions.
    """

    def __init__(self):
        self.repository = QuestionRepository()

    async def create_question(self, question_data: QuestionCreate) -> Question:
        """
        Crée une nouvelle question avec la date/heure actuelle.

        Args:
            question_data: Données de la question à créer

        Returns:
            Question: L'objet Question créé
        """
        question = Question(
            # _id=question_data._id,
            question=question_data.question,
            subject=question_data.subject,
            use=question_data.use,
            correct=question_data.correct,
            responseA=question_data.responseA,
            responseB=question_data.responseB,
            responseC=question_data.responseC,
            responseD=question_data.responseD,
            remark=question_data.remark,
            created_by=question_data.created_by or 1,
            created_at=datetime.now(ZoneInfo("Europe/Paris")).replace(microsecond=0),
        )

        generated_id = await self.repository.insert_question(question)

        return question.model_copy(update={"id": generated_id})

    async def get_question_by_id(self, question_id: str) -> Question:
        """
        Retourne une question depuis son id MongoDB.

        Args:
            question_id: id

        Returns:
            Question: L'objet Question recherché
        """

        question = await self.repository.get_question_by_id(question_id)

        if question is None:
            raise LookupError("Question introuvable")
        return question
