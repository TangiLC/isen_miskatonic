import asyncio
import concurrent
from models.questionnaire import Questionnaire
from utils.database import database
from bson import ObjectId
from typing import Any, Dict, List, Optional


class QuestionnaireRepository:
    """
    Repository pour les opérations de base de données sur les questionnaires.
    Utilise pymongo (synchrone) avec des adaptateurs pour FastAPI (async).
    """

    def __init__(self):
        pass  # La collection sera récupérée dynamiquement

    def _get_collection(self):
        """
        Récupère la collection de façon thread-safe.
        """
        return database.get_collection("questionnaires")

    ################################################################################
    async def insert_questionnaire(self, questionnaire: Questionnaire) -> str:
        """
        Insère un questionnaire en base de données MongoDB (version async wrapper).
        Args:
            questionnaire (Questionnaire): L'objet Questionnaire à insérer
        Returns:
            str: L'ID généré automatiquement par MongoDB
        """

        def _sync_insert():
            try:
                collection = self._get_collection()

                questionnaire_dict = {
                    "title": questionnaire.title,
                    "subject": questionnaire.subject,
                    "use": questionnaire.use,
                    "questions": questionnaire.questions,
                    "remark": questionnaire.remark,
                    "status": questionnaire.status,
                    "created_by": questionnaire.created_by,
                    "created_at": questionnaire.created_at,
                    "edited_at": questionnaire.edited_at,
                }

                result = collection.insert_one(questionnaire_dict)

                print(f"Questionnaire inséré avec l'ID: {result.inserted_id}")
                return str(result.inserted_id)

            except Exception as e:
                print(f"Erreur lors de l'insertion: {e}")
                raise

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(executor, _sync_insert)
            return result

    ################################################################################
    async def get_questionnaire_by_id(
        self, questionnaire_id: str
    ) -> Optional[Questionnaire]:
        """
        Récupère un questionnaire par son ID MongoDB.
        """
        collection = self._get_collection()

        def _sync_get():
            clean_id = questionnaire_id.strip().strip("\"'")
            try:
                oid = ObjectId(clean_id)
            except ValueError:
                raise ValueError("Identifiant MongoDB invalide")

            doc = collection.find_one({"_id": oid})
            if not doc:
                return None

            return Questionnaire(
                id=str(doc["_id"]),
                title=doc.get("title"),
                subject=doc.get("subject", []),
                use=doc.get("use", []),
                questions=doc.get("questions", []),
                remark=doc.get("remark"),
                status=doc.get("status") or "draft",
                created_by=doc.get("created_by"),
                created_at=doc.get("created_at"),
                edited_at=doc.get("edited_at"),
            )

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            return await loop.run_in_executor(executor, _sync_get)

    ################################################################################
    async def update_questionnaire(
        self, questionnaire_id: str, update_data: Dict[str, Any]
    ) -> bool:
        """
        Met à jour un questionnaire en base de données MongoDB.

        Args:
            questionnaire_id: ID du questionnaire à modifier
            update_data: Dictionnaire des champs à mettre à jour

        Returns:
            bool: True si la mise à jour a réussi
        """

        def _sync_update():
            try:
                collection = self._get_collection()
                clean_id = questionnaire_id.strip().strip("\"'")

                try:
                    oid = ObjectId(clean_id)
                except ValueError:
                    raise ValueError("Identifiant MongoDB invalide")

                result = collection.update_one({"_id": oid}, {"$set": update_data})

                if result.matched_count == 0:
                    raise LookupError("Questionnaire introuvable")

                print(
                    f"Questionnaire {questionnaire_id} mis à jour: {result.modified_count} champ(s) modifié(s)"
                )
                return result.modified_count > 0

            except Exception as e:
                print(f"Erreur lors de la mise à jour: {e}")
                raise

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(executor, _sync_update)
            return result

    ################################################################################
    async def get_all_questionnaires(self) -> List[Questionnaire]:
        """
        Récupère l'ensemble des questionnaires stockés dans la collection.
        """
        collection = self._get_collection()

        def _sync_get_all():
            cursor = collection.find()  # pas de filtre
            results: List[Questionnaire] = []
            for doc in cursor:
                results.append(
                    Questionnaire(
                        id=str(doc["_id"]),
                        title=doc.get("title"),
                        subject=doc.get("subject", []),
                        use=doc.get("use", []),
                        questions=doc.get("questions", []),
                        remark=doc.get("remark"),
                        status=(doc.get("status") or "draft"),
                        created_by=doc.get("created_by"),
                        created_at=doc.get("created_at"),
                        edited_at=doc.get("edited_at"),
                    )
                )
            return results

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            return await loop.run_in_executor(executor, _sync_get_all)
