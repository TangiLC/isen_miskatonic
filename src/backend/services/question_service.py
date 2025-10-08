from datetime import datetime
from typing import List
from zoneinfo import ZoneInfo
from models.question import Question, QuestionStatus
from schemas.question import QuestionCreate, QuestionUpdate
from repositories.question_repository import QuestionRepository


class QuestionService:
    """
    Service pour la gestion des questions.
    """

    def __init__(self):
        self.repository = QuestionRepository()

    ################################################################################
    async def create_question(
        self, question_data: QuestionCreate, user_id: int
    ) -> Question:
        """
        Crée une nouvelle question avec la date/heure actuelle.

        Args:
            question_data: Données de la question à créer
            user_id : ID de l'utilisateur (extrait du JWT)

        Returns:
            Question: L'objet Question créé
        """
        # Déterminer le statut : utiliser celui fourni ou calculer automatiquement
        if question_data.status is not None:
            # Utiliser le statut explicitement fourni
            status = question_data.status
        else:
            # Logique par défaut : draft si pas de réponses correctes, sinon active
            status = (
                QuestionStatus.DRAFT
                if not question_data.corrects
                else QuestionStatus.ACTIVE
            )

        question = Question(
            question=question_data.question,
            subject=question_data.subject,
            use=question_data.use,
            corrects=question_data.corrects or [],
            responses=question_data.responses or [],
            remark=question_data.remark,
            status=status or "draft",
            created_by=user_id,
            created_at=datetime.now(ZoneInfo("Europe/Paris")).replace(microsecond=0),
            edited_at=None,
        )

        generated_id = await self.repository.insert_question(question)

        return question.model_copy(update={"id": generated_id})

    ################################################################################
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
        if not getattr(question, "status", None):
            question.status = QuestionStatus.DRAFT
        return question

    ################################################################################
    async def get_all_questions(self) -> List[Question]:
        """
        Retourne la liste complète des questions.
        """
        return await self.repository.get_all_questions()

    ################################################################################
    async def get_subjects(self) -> List[str]:
        """
        Retourne la liste des sujets distincts.
        """
        return await self.repository.get_distinct_subjects()

    ################################################################################
    async def get_uses(self) -> List[str]:
        """
        Retourne la liste des uses distincts.
        """
        return await self.repository.get_distinct_uses()

    ################################################################################
    async def get_questions_by_subject_contains(
        self, subject_name: str, limit: int = 50
    ) -> List[Question]:
        """
        Retourne les questions dont au moins un sujet contient ***.
        """
        return await self.repository.search_questions_by_subject_substring(
            subject_name=subject_name, limit=limit
        )

    ################################################################################

    async def update_question(
        self, question_id: str, question_data: QuestionUpdate, user_id: int
    ) -> Question:
        """
        Met à jour une question existante.
        Args:
            question_id: ID de la question à modifier
            question_data: Données à mettre à jour
            user_id: ID de l'utilisateur qui fait la modification
        Returns:
            Question: La question mise à jour
        Raises:
            LookupError: Si la question n'existe pas
            PermissionError: Si l'utilisateur n'est pas le créateur
        """
        # Vérifier que la question existe et récupérer le créateur
        existing_question = await self.repository.get_question_by_id(question_id)
        if existing_question is None:
            raise LookupError("Question introuvable")

        # Vérifier les permissions (seul le créateur peut modifier)
        if existing_question.created_by != user_id:
            raise PermissionError("Seul le créateur de la question peut la modifier")

        # Convertir les données en dictionnaire, en excluant les champs non définis
        update_data = question_data.model_dump(exclude_unset=True)

        # Ajouter la date de modification
        update_data["edited_at"] = datetime.now(ZoneInfo("Europe/Paris")).replace(
            microsecond=0
        )

        # Effectuer la mise à jour
        await self.repository.update_question(question_id, update_data)

        # Retourner la question mise à jour
        return await self.repository.get_question_by_id(question_id)
