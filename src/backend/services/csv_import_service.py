from typing import List, Dict, Any
from fastapi import UploadFile
from schemas.question import QuestionCreate, CSVImportResponse
from services.question_service import QuestionService
from utils.csv_processor import CSVQuestionProcessor


class CSVImportService:
    """Service pour l'import CSV de questions"""

    def __init__(self):
        self.question_service = QuestionService()

    async def import_questions_from_csv(
        self,
        file: UploadFile,
        user_id: int,
        fix_subjects: bool = True,
        subject_threshold: float = 0.90,
    ) -> CSVImportResponse:
        """Importe des questions depuis un fichier CSV"""

        # Validation du fichier
        self._validate_csv_file(file)

        # Lecture du contenu
        content = await file.read()
        csv_content = content.decode("utf-8")

        # Traitement du CSV
        processor = CSVQuestionProcessor(
            fix_subjects=fix_subjects, subject_threshold=subject_threshold
        )

        questions_data = processor.process_csv_content(csv_content)
        stats = processor.get_stats()

        # Import des questions
        return await self._import_questions(questions_data, user_id, stats)

    def _validate_csv_file(self, file: UploadFile) -> None:
        """Valide le fichier CSV"""
        if not file.filename:
            raise ValueError("Nom de fichier manquant")

        if not file.filename.lower().endswith(".csv"):
            raise ValueError("Le fichier doit être au format CSV")

        if file.size and file.size > 10 * 1024 * 1024:  # 10MB max
            raise ValueError("Le fichier est trop volumineux (max 10MB)")

    async def _import_questions(
        self, questions_data: List[QuestionCreate], user_id: int, stats: Dict[str, int]
    ) -> CSVImportResponse:
        """Importe la liste des questions"""
        imported_count = 0
        errors = []

        for question_data in questions_data:
            try:
                await self.question_service.create_question(question_data, user_id)
                imported_count += 1
            except Exception as e:
                errors.append(
                    {
                        "question": (
                            question_data.question[:50] + "..."
                            if len(question_data.question) > 50
                            else question_data.question
                        ),
                        "error": str(e),
                    }
                )

        return CSVImportResponse(
            success=len(errors)
            < len(questions_data),  # Succès si au moins une question importée
            imported=imported_count,
            errors=len(errors),
            merged=stats.get("merged_questions", 0),
            error_details=errors[:10],  # Limite à 10 erreurs
            message=self._generate_import_message(imported_count, len(errors), stats),
        )

    def _generate_import_message(
        self, imported: int, errors: int, stats: Dict[str, int]
    ) -> str:
        """Génère le message de résultat d'import"""
        parts = [f"{imported} questions importées"]

        if errors > 0:
            parts.append(f"{errors} erreurs")

        if stats.get("merged_questions", 0) > 0:
            parts.append(f"{stats['merged_questions']} questions fusionnées")

        if stats.get("subject_corrections", 0) > 0:
            parts.append(f"{stats['subject_corrections']} sujets corrigés")

        return f"Import terminé: {', '.join(parts)}"
