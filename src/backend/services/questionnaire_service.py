from datetime import datetime
from typing import List
from zoneinfo import ZoneInfo
from models.questionnaire import Questionnaire, QuestionnaireStatus
from schemas.questionnaire import QuestionnaireCreate, QuestionnaireUpdate
from repositories.questionnaire_repository import QuestionnaireRepository


class QuestionnaireService:
    """
    Service pour la gestion des questionnaires.
    """

    def __init__(self):
        self.repository = QuestionnaireRepository()

    ################################################################################
    async def create_questionnaire(
        self, questionnaire_data: QuestionnaireCreate, user_id: int
    ) -> Questionnaire:
        """
        Crée un nouveau questionnaire avec la date/heure actuelle.

        Args:
            questionnaire_data: Données du questionnaire à créer
            user_id: ID de l'utilisateur (extrait du JWT)

        Returns:
            Questionnaire: L'objet Questionnaire créé
        """
        # Déterminer le statut : utiliser celui fourni ou calculer automatiquement
        if questionnaire_data.status is not None:
            status = questionnaire_data.status
        else:
            # Logique par défaut : draft si pas de questions, sinon active
            status = (
                QuestionnaireStatus.DRAFT
                if not questionnaire_data.questions
                else QuestionnaireStatus.ACTIVE
            )

        questionnaire = Questionnaire(
            title=questionnaire_data.title,
            subject=questionnaire_data.subject or [],
            use=questionnaire_data.use or [],
            questions=questionnaire_data.questions or [],
            remark=questionnaire_data.remark,
            status=status,
            created_by=user_id,
            created_at=datetime.now(ZoneInfo("Europe/Paris")).replace(microsecond=0),
            edited_at=None,
        )

        generated_id = await self.repository.insert_questionnaire(questionnaire)

        return questionnaire.model_copy(update={"id": generated_id})

    ################################################################################
    async def get_questionnaire_by_id(self, questionnaire_id: str) -> Questionnaire:
        """
        Retourne un questionnaire depuis son id MongoDB.

        Args:
            questionnaire_id: id

        Returns:
            Questionnaire: L'objet Questionnaire recherché
        """
        questionnaire = await self.repository.get_questionnaire_by_id(questionnaire_id)

        if questionnaire is None:
            raise LookupError("Questionnaire introuvable")
        if not getattr(questionnaire, "status", None):
            questionnaire.status = QuestionnaireStatus.DRAFT
        return questionnaire

    ################################################################################
    async def update_questionnaire(
        self,
        questionnaire_id: str,
        questionnaire_data: QuestionnaireUpdate,
        user_id: int,
    ) -> Questionnaire:
        """
        Met à jour un questionnaire existant.

        Args:
            questionnaire_id: ID du questionnaire à modifier
            questionnaire_data: Données à mettre à jour
            user_id: ID de l'utilisateur qui fait la modification

        Returns:
            Questionnaire: Le questionnaire mis à jour

        Raises:
            LookupError: Si le questionnaire n'existe pas
            PermissionError: Si l'utilisateur n'est pas le créateur
        """
        # Vérifier que le questionnaire existe et récupérer le créateur
        existing_questionnaire = await self.repository.get_questionnaire_by_id(
            questionnaire_id
        )
        if existing_questionnaire is None:
            raise LookupError("Questionnaire introuvable")

        # Vérifier les permissions (seul le créateur peut modifier)
        if existing_questionnaire.created_by != user_id:
            raise PermissionError("Seul le créateur du questionnaire peut le modifier")

        # Convertir les données en dictionnaire, en excluant les champs non définis
        update_data = questionnaire_data.model_dump(exclude_unset=True)

        # Ajouter la date de modification
        update_data["edited_at"] = datetime.now(ZoneInfo("Europe/Paris")).replace(
            microsecond=0
        )

        # Effectuer la mise à jour
        await self.repository.update_questionnaire(questionnaire_id, update_data)

        # Retourner le questionnaire mis à jour
        return await self.repository.get_questionnaire_by_id(questionnaire_id)

    ################################################################################
    async def get_all_questionnaires(self) -> List[Questionnaire]:
        """
        Retourne la liste complète des questionnaires.
        """
        return await self.repository.get_all_questionnaires()
