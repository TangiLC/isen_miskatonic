import csv
import io
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from typing import Dict, List, Iterator, Tuple
from schemas.question import QuestionCreate, QuestionStatus


class CSVQuestionProcessor:
    """Classe pour traiter les fichiers CSV de questions"""

    def __init__(self, fix_subjects: bool = True, subject_threshold: float = 0.90):
        self.fix_subjects = fix_subjects
        self.subject_threshold = subject_threshold
        self.subjects_count: Dict[str, int] = {}
        self.questions_cache: Dict[str, dict] = {}
        self.stats = {
            "total_rows": 0,
            "valid_questions": 0,
            "merged_questions": 0,
            "subject_corrections": 0,
        }

    def normalize_text(self, s: str) -> str:
        """Normalise le texte pour la comparaison"""
        if not s:
            return ""
        s = unicodedata.normalize("NFKD", s)
        s = "".join(ch for ch in s if not unicodedata.combining(ch))
        return "".join(ch for ch in s.lower() if ch.isalnum())

    def letter_similarity(self, a: str, b: str) -> float:
        """Calcule la similarité basée sur les lettres communes"""
        na, nb = self.normalize_text(a), self.normalize_text(b)
        if not na and not nb:
            return 1.0
        if not na or not nb:
            return 0.0
        ca, cb = Counter(na), Counter(nb)
        inter = sum((ca & cb).values())
        denom = max(len(na), len(nb))
        return inter / denom if denom else 0.0

    def sequence_similarity(self, a: str, b: str) -> float:
        """Calcule la similarité de séquence (Levenshtein)"""
        na, nb = self.normalize_text(a), self.normalize_text(b)
        return SequenceMatcher(None, na, nb).ratio()

    def similarity(self, a: str, b: str) -> float:
        """Calcule la similarité globale"""
        ls = self.letter_similarity(a, b)
        ss = self.sequence_similarity(a, b)
        return 0.5 * ls + 0.5 * ss

    def canonicalize_subject(self, subject: str) -> Tuple[str, bool]:
        """Retourne un sujet existant le plus proche si score >= seuil"""
        if not subject or not self.subjects_count:
            return subject, False

        if subject in self.subjects_count:
            return subject, False

        best_subject = None
        best_score = 0.0

        for s in self.subjects_count.keys():
            if s == subject:
                return s, False
            score = self.similarity(subject, s)
            if score > best_score:
                best_score = score
                best_subject = s

        if best_subject and best_score >= self.subject_threshold:
            return best_subject, True
        return subject, False

    def strip_or_none(self, v: str) -> str:
        """Nettoie les chaînes"""
        if v is None:
            return None
        v2 = v.strip()
        return v2 if v2 else None

    def normalize_correct(self, v: str) -> List[str]:
        """Normalise le champ 'correct'"""
        if not v:
            return []

        txt = v.strip().upper()
        if not txt:
            return []
        txt = txt.replace(",", " ").replace("-", " ")
        parts = [p for p in txt.split() if p]
        return parts

    def standardize_question(self, question: str) -> str:
        """Standardise une question"""
        if not question:
            return question

        standardized = question.strip()
        if standardized.endswith(":"):
            standardized = standardized[:-1].strip()

        return standardized

    def create_question_key(self, question: str) -> str:
        """Crée une clé unique pour détecter les doublons"""
        return self.standardize_question(question).lower()

    def merge_responses_and_corrects(
        self,
        existing_responses: List[str],
        new_responses: List[str],
        existing_corrects: List[str],
        new_corrects: List[str],
    ) -> Tuple[List[str], List[str]]:
        """Fusionne les réponses et corrects"""
        all_responses = existing_responses + [
            r for r in new_responses if r not in existing_responses
        ]
        all_corrects = list(set(existing_corrects + new_corrects))
        return all_responses, sorted(all_corrects)

    def validate_csv_headers(self, fieldnames: List[str]) -> None:
        """Valide les en-têtes du CSV"""
        required_fields = [
            "question",
            "subject",
            "use",
            "correct",
            "responseA",
            "responseB",
            "responseC",
            "responseD",
        ]
        missing_fields = [field for field in required_fields if field not in fieldnames]
        if missing_fields:
            raise ValueError(
                f"Colonnes manquantes dans le CSV: {', '.join(missing_fields)}"
            )

    def determine_status(self, corrects: List[str]) -> QuestionStatus:
        """Détermine le statut de la question selon les corrects"""
        if not corrects or len(corrects) == 0:
            return QuestionStatus.DRAFT
        return QuestionStatus.ACTIVE

    def process_csv_content(self, csv_content: str) -> List[QuestionCreate]:
        """Traite le contenu CSV et retourne la liste des questions"""
        csv_file = io.StringIO(csv_content)
        reader = csv.DictReader(csv_file)

        if not reader.fieldnames:
            raise ValueError("Le fichier CSV ne contient pas d'en-têtes")

        self.validate_csv_headers(reader.fieldnames)

        for row in reader:
            self.stats["total_rows"] += 1
            self._process_csv_row(row)

        # Conversion en QuestionCreate
        questions = []
        for question_data in self.questions_cache.values():
            questions.append(QuestionCreate(**question_data))

        self.stats["valid_questions"] = len(questions)
        return questions

    def _process_csv_row(self, row: Dict[str, str]) -> None:
        """Traite une ligne du CSV"""
        # Nettoyage initial
        question = self.strip_or_none(row.get("question"))
        if question:
            question = self.standardize_question(question)

        subject = self.strip_or_none(row.get("subject"))
        use = self.strip_or_none(row.get("use"))
        correct = self.normalize_correct(row.get("correct", ""))
        responseA = self.strip_or_none(row.get("responseA"))
        responseB = self.strip_or_none(row.get("responseB"))
        responseC = self.strip_or_none(row.get("responseC"))
        responseD = self.strip_or_none(row.get("responseD"))
        remark = self.strip_or_none(row.get("remark"))

        if not question:
            return  # Ignore les lignes sans question

        question_key = self.create_question_key(question)

        # Correction du sujet
        subject_corrected = False
        if self.fix_subjects and subject:
            canon, corrected = self.canonicalize_subject(subject)
            subject = canon
            subject_corrected = corrected
            self.subjects_count[canon] = self.subjects_count.get(canon, 0) + 1
            if corrected:
                self.stats["subject_corrections"] += 1

        # Construction des réponses et corrects
        response_mapping = {
            "A": responseA,
            "B": responseB,
            "C": responseC,
            "D": responseD,
        }

        liste_responses = [resp for resp in response_mapping.values() if resp]
        liste_corrects = [
            response_mapping[label]
            for label in correct
            if label in response_mapping and response_mapping[label]
        ]

        # Gestion des doublons
        if question_key in self.questions_cache:
            self._merge_duplicate_question(
                question_key, liste_responses, liste_corrects
            )
            return

        # Détermination du statut
        status = self.determine_status(liste_corrects)

        # Nouvelle question
        cleaned_row = {
            "question": question,
            "subject": [subject] if subject else [],
            "use": [use] if use else [],
            "responses": liste_responses,
            "corrects": liste_corrects,
            "remark": remark,
            "status": status,
        }

        self.questions_cache[question_key] = cleaned_row

    def _merge_duplicate_question(
        self, question_key: str, new_responses: List[str], new_corrects: List[str]
    ) -> None:
        """Fusionne une question dupliquée"""
        existing_question = self.questions_cache[question_key]
        existing_responses = existing_question.get("responses", [])
        existing_corrects = existing_question.get("corrects", [])

        merged_responses, merged_corrects = self.merge_responses_and_corrects(
            existing_responses, new_responses, existing_corrects, new_corrects
        )

        self.questions_cache[question_key]["responses"] = merged_responses
        self.questions_cache[question_key]["corrects"] = merged_corrects

        # Mise à jour du statut après la fusion
        self.questions_cache[question_key]["status"] = self.determine_status(
            merged_corrects
        )

        self.stats["merged_questions"] += 1

    def get_stats(self) -> Dict[str, int]:
        """Retourne les statistiques de traitement"""
        return self.stats.copy()
