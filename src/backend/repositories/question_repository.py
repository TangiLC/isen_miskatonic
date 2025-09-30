import asyncio

import concurrent
from models.question import Question
from bson import ObjectId
from typing import Any, Dict, List, Optional

from utils.mg_database import Database


class QuestionRepository:
    """
    Repository pour les opérations de base de données sur les questions.
    Utilise pymongo (synchrone) avec des adaptateurs pour FastAPI (async).
    """

    def __init__(self):
        pass  # La collection sera récupérée dynamiquement

    def _get_collection(self):
        """
        Récupère la collection de façon thread-safe.
        """
        return Database.get_collection()

    ################################################################################
    async def insert_question(self, question: Question) -> str:
        """
        Insère une question en base de données MongoDB (version async wrapper).

        Args:
            question (Question): L'objet Question à insérer

        Returns:
            str: L'ID généré automatiquement par MongoDB
        """

        def _sync_insert():
            try:
                collection = self._get_collection()

                question_dict = {
                    "question": question.question,
                    "subject": question.subject,
                    "use": question.use,
                    "corrects": question.corrects,
                    "responses": question.responses,
                    "remark": question.remark,
                    "status": question.status,
                    "created_by": question.created_by,
                    "created_at": question.created_at,
                    "edited_at": question.edited_at,
                }

                # Dé-commenter pour ne pas enregistrer les champs null
                # cleaned_dict = {k: v for k, v in question_dict.items() if v is not None}
                # result = collection.insert_one(cleaned_dict)
                # enregistre même les champs null
                result = collection.insert_one(question_dict)

                print(f"Question insérée avec l'ID: {result.inserted_id}")
                return str(result.inserted_id)

            except Exception as e:
                print(f"Erreur lors de l'insertion: {e}")
                raise

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(executor, _sync_insert)
            return result

    ################################################################################
    async def get_question_by_id(self, question_id: str) -> Optional[Question]:
        collection = self._get_collection()

        def _sync_get():
            clean_id = question_id.strip().strip("\"'")
            try:
                oid = ObjectId(clean_id)
            except ValueError:
                raise ValueError("Identifiant MongoDB invalide")

            doc = collection.find_one({"_id": oid})
            if not doc:
                return None

            return Question(
                id=str(doc["_id"]),
                question=doc.get("question"),
                subject=doc.get("subject", []),
                use=doc.get("use", []),
                corrects=doc.get("corrects", []),
                responses=doc.get("responses", []),
                remark=doc.get("remark", ""),
                status=doc.get("status") or "draft",
                created_by=doc.get("created_by", ""),
                created_at=doc.get("created_at", ""),
                edited_at=doc.get("edited_at", ""),
            )

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            return await loop.run_in_executor(executor, _sync_get)

    ################################################################################
    async def get_questions_by_subject(
        self, subject: str, limit: int = 10
    ) -> List[dict]:
        """
        Récupère les questions par sujet (version async wrapper).
        """

        def _sync_get_by_subject():
            collection = self._get_collection()
            cursor = collection.find({"subject": subject}).limit(limit)
            results = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])  # Convertir ObjectId en string
                results.append(doc)
            return results

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(executor, _sync_get_by_subject)
            return result

    ################################################################################
    async def get_all_questions(self) -> List[Question]:
        """
        Récupère l'ensemble des questions stockées dans la collection.
        """
        collection = self._get_collection()

        def _sync_get_all():
            cursor = collection.find()  # pas de filtre
            results: List[Question] = []
            for doc in cursor:
                results.append(
                    Question(
                        id=str(doc["_id"]),
                        question=doc.get("question"),
                        subject=doc.get("subject", []),
                        use=doc.get("use", []),
                        corrects=doc.get("corrects", []),
                        responses=doc.get("responses", []),
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

    ################################################################################
    async def get_distinct_subjects(self) -> List[str]:
        """
        Retourne la liste distincte des sujets présents dans la collection.
        """

        def _sync_distinct():
            collection = self._get_collection()
            subjects = collection.distinct("subject")
            subjects = [s for s in subjects if s]  # filtre None / ""
            subjects.sort()
            return subjects

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            return await loop.run_in_executor(executor, _sync_distinct)

    ################################################################################
    async def get_distinct_uses(self) -> List[str]:
        """
        Retourne la liste distincte des champs 'use' présents dans la collection.
        """

        def _sync_distinct():
            collection = self._get_collection()
            uses = collection.distinct("use")
            uses = [u for u in uses if u]  # filtre None / ""
            uses.sort()
            return uses

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            return await loop.run_in_executor(executor, _sync_distinct)

    ###############################################################################
    async def update_question(
        self, question_id: str, update_data: Dict[str, Any]
    ) -> bool:
        """
        Met à jour une question en base de données MongoDB.
        Args:
            question_id: ID de la question à modifier
            update_data: Dictionnaire des champs à mettre à jour
        Returns:
            bool: True si la mise à jour a réussi
        """

        def _sync_update():
            try:
                collection = self._get_collection()
                clean_id = question_id.strip().strip("\"'")

                try:
                    oid = ObjectId(clean_id)
                except ValueError:
                    raise ValueError("Identifiant MongoDB invalide")

                # Dé-commenter pour ne pas enregistrer les champs null
                # cleaned_data = {k: v for k, v in update_data.items() if v is not None}
                # result = collection.update_one({"_id": oid}, {"$set": cleaned_data})
                # enregistre même les champs null
                result = collection.update_one({"_id": oid}, {"$set": update_data})

                if result.matched_count == 0:
                    raise LookupError("Question introuvable")

                print(
                    f"Question {question_id} mise à jour: {result.modified_count} champ(s) modifié(s)"
                )
                return result.modified_count > 0

            except Exception as e:
                print(f"Erreur lors de la mise à jour: {e}")
                raise

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(executor, _sync_update)
            return result
