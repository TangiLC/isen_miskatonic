import asyncio

import concurrent
from models.question import Question
from database import database
from bson import ObjectId
from typing import List, Optional


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
        return database.get_collection()

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
                    "correct": question.correct,
                    "responseA": question.responseA,
                    "responseB": question.responseB,
                    "responseC": question.responseC,
                    "responseD": question.responseD,
                    "remark": question.remark,
                    "created_by": question.created_by,
                    "created_at": question.created_at,
                }

                cleaned_dict = {k: v for k, v in question_dict.items() if v is not None}

                result = collection.insert_one(cleaned_dict)

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
                subject=doc.get("subject"),
                use=doc.get("use"),
                correct=doc.get("correct", []),
                responseA=doc.get("responseA"),
                responseB=doc.get("responseB"),
                responseC=doc.get("responseC"),
                responseD=doc.get("responseD"),
                remark=doc.get("remark"),
                created_by=doc.get("created_by"),
                created_at=doc.get("created_at"),
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
