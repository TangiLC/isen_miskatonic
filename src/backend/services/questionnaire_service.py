from datetime import datetime
from typing import List
from zoneinfo import ZoneInfo
from models.questionnaire import Questionnaire, QuestionnaireStatus
from schemas.questionnaire import (
    QuestionnaireCreate,
    QuestionnaireResponse,
    QuestionnaireUpdate,
)
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
            subjects=questionnaire_data.subjects or [],
            uses=questionnaire_data.uses or [],
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
    async def get_questionnaire_by_id(
        self,
        questionnaire_id: str,
        format: str = "short",
    ) -> QuestionnaireResponse:
        """
        Retourne un questionnaire depuis son id MongoDB.
        - format == "short": questions avec id et question uniquement
        - format == "full": questions complètes avec tous les champs (corrects, responses, etc.)
        """
        if format == "short":
            questionnaire = await self.repository.get_short_questionnaire_by_id(
                questionnaire_id
            )
            if questionnaire is None:
                raise LookupError("Questionnaire introuvable")
            if not getattr(questionnaire, "status", None):
                questionnaire.status = QuestionnaireStatus.DRAFT
            return questionnaire

        elif format == "full":
            questionnaire = await self.repository.get_full_questionnaire_by_id(
                questionnaire_id
            )
            if questionnaire is None:
                raise LookupError("Questionnaire introuvable")
            if not getattr(questionnaire, "status", None):
                questionnaire.status = QuestionnaireStatus.DRAFT
            return questionnaire

        else:
            # Format non reconnu
            print(f"Format non implémenté : {format}")
            raise ValueError(
                f"Format '{format}' non supporté. Utilisez 'short' ou 'full'."
            )

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
        existing_questionnaire = await self.repository.get_short_questionnaire_by_id(
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

        # Effectuer la mise à jour - écrasement de la liste antérieure des questions
        await self.repository.update_questionnaire(questionnaire_id, update_data)

        # Retourner le questionnaire mis à jour
        return await self.repository.get_short_questionnaire_by_id(questionnaire_id)

    ################################################################################
    async def get_all_questionnaires(self) -> List[Questionnaire]:
        """
        Retourne la liste complète des questionnaires.
        """
        return await self.repository.get_all_questionnaires()
