import os
import csv
import sys
import unicodedata
from collections import Counter
from typing import Dict, Iterator, List, Optional, Any

from pymongo import MongoClient
from pymongo.errors import BulkWriteError, ServerSelectionTimeoutError
from dotenv import load_dotenv
from difflib import SequenceMatcher

load_dotenv()

MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27018")
DB_NAME = os.getenv("DB_NAME", "miskatonic")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "questions")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))
CSV_SOURCE = os.getenv("CSV_SOURCE", "./questions.csv")

SUBJECT_FIX_ENABLED = os.getenv("SUBJECT_FIX_ENABLED", "true")
SUBJECT_SEUIL = float(os.getenv("SUBJECT_SEUIL", "0.90"))


def normalize_text(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return "".join(ch for ch in s.lower() if ch.isalnum())


def letter_similarity(a: str, b: str) -> float:
    # % lettres communes: nb commun/max lettres
    na, nb = normalize_text(a), normalize_text(b)
    if not na and not nb:
        return 1.0
    if not na or not nb:
        return 0.0
    ca, cb = Counter(na), Counter(nb)
    inter = sum((ca & cb).values())
    denom = max(len(na), len(nb))
    return inter / denom if denom else 0.0


def sequence_similarity(a: str, b: str) -> float:
    # % séquences communes : voir 'Distance de Levenshtein'
    na, nb = normalize_text(a), normalize_text(b)
    return SequenceMatcher(None, na, nb).ratio()


def similarity(a: str, b: str) -> float:
    # pondération actuelle : autant de poids pour similarité lettres et séquence (à ajuster)
    ls = letter_similarity(a, b)
    ss = sequence_similarity(a, b)
    return 0.5 * ls + 0.5 * ss


def canonicalize_subject(
    subject: str, known_subjects: Dict[str, int], seuil: float
) -> str:
    """
    Retourne un subject existant
    le plus proche si score >= seuil, sinon le subject tel quel.
    known_subjects: dict {subject_canonique: count}
    """
    if subject is None or not known_subjects:
        return subject

    if subject in known_subjects:
        return subject  # égalité stricte

    best_subject = None
    best_score = 0.0

    for s in known_subjects.keys():
        if s == subject:
            return s
        score = similarity(subject, s)
        if score > best_score:
            best_score = score
            best_subject = s

    if best_subject is not None and best_score >= seuil:
        return best_subject
    return subject


# --- Normalisations champs ---
def strip_or_none(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v2 = v.strip()
    return v2 if v2 else None


def normalize_correct(v: Optional[str]) -> Optional[List[str]]:
    """
    Normalisation du champ 'correct'
    """
    if v is None:
        return []

    txt = v.strip().upper()
    if not txt:
        return []
    txt = txt.replace(",", " ").replace("-", " ")
    parts = [p for p in txt.split() if p]

    return parts


def standardize_question(question: str) -> str:
    """
    Standardise une question :
    - Supprime les espaces en début/fin
    - Supprime le dernier caractère si c'est ":"
    """
    if not question:
        return question

    standardized = question.strip()
    if standardized.endswith(":"):
        standardized = standardized[:-1].strip()

    return standardized


def create_question_key(question: str) -> str:
    """
    Crée une clé unique basée uniquement sur la question standardisée pour détecter les doublons
    """
    return standardize_question(question).lower()


def merge_responses_and_corrects(
    existing_reponses: List[str],
    new_reponses: List[str],
    existing_corrects: List[str],
    new_corrects: List[str],
) -> tuple:
    """
    Fusionne les réponses et corrects en supprimant les doublons
    Retourne (reponses_merged, corrects_merged)
    """
    # Fusion des réponses en préservant l'ordre et supprimant les doublons
    all_reponses = existing_reponses + [
        r for r in new_reponses if r not in existing_reponses
    ]

    # Fusion des corrects en supprimant les doublons
    all_corrects = list(set(existing_corrects + new_corrects))

    return all_reponses, sorted(all_corrects)


# --- Lecture CSV + nettoyage + correction des subjects ---
def read_csv_rows(
    file_path: str, fix_subjects: bool = True, subject_seuil: float = 0.90
) -> Iterator[dict]:
    """
    Lecture CSV avec nettoyage:
    - supprime espaces en trop
    - 'correct' -> normalisation
    - 'subject' -> rapprochement /correction typo
    - déduplication des questions identiques
    - restructuration responseA/B/C/D -> liste "responses"
    """
    subjects_count: Dict[str, int] = {}
    questions_cache: Dict[str, dict] = {}  # Cache pour détecter les doublons

    with open(file_path, "r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            return

        for row in reader:
            # Nettoyage initial des colonnes
            question = strip_or_none(row.get("question"))
            if question:
                question = standardize_question(
                    question
                )  # Standardisation de la question
            subject = strip_or_none(row.get("subject"))
            use = strip_or_none(row.get("use"))
            correct = normalize_correct(row.get("correct"))
            responseA = strip_or_none(row.get("responseA"))
            responseB = strip_or_none(row.get("responseB"))
            responseC = strip_or_none(row.get("responseC"))
            responseD = strip_or_none(row.get("responseD"))
            remark = strip_or_none(row.get("remark"))

            # Ignorer les lignes sans question
            if not question:
                continue

            # Création de la clé pour détecter les doublons (basée uniquement sur la question)
            question_key = create_question_key(question or "")

            # Correction du subject si activée
            if fix_subjects and subject:
                canon = canonicalize_subject(
                    subject, subjects_count, seuil=subject_seuil
                )
                subject = canon
                subjects_count[canon] = subjects_count.get(canon, 0) + 1

            # Création des listes de réponses et corrects pour cette ligne
            liste_reponses = []
            liste_corrects = []

            # Mapping des réponses avec leurs labels
            response_mapping = {
                "A": responseA,
                "B": responseB,
                "C": responseC,
                "D": responseD,
            }

            # Construction de la liste des réponses
            for label in ["A", "B", "C", "D"]:
                response_text = response_mapping[label]
                if response_text:
                    liste_reponses.append(response_text)

            # Construction de la liste des textes corrects
            for correct_label in correct:
                if (
                    correct_label in response_mapping
                    and response_mapping[correct_label]
                ):
                    liste_corrects.append(response_mapping[correct_label])

            # Vérification des doublons
            if question_key in questions_cache:
                existing_question = questions_cache[question_key]
                existing_reponses = existing_question.get("responses", [])
                existing_corrects = existing_question.get("corrects", [])

                # Fusion des réponses et corrects
                merged_reponses, merged_corrects = merge_responses_and_corrects(
                    existing_reponses,
                    liste_reponses,
                    existing_corrects,
                    liste_corrects,
                )

                # Mise à jour de la question existante
                questions_cache[question_key]["responses"] = merged_reponses
                questions_cache[question_key]["corrects"] = merged_corrects

                print(
                    f"Question fusionnée: {question[:30]}... | Réponses:{len(merged_reponses)}"
                )
                continue

            # Création du document final
            cleaned_row = {
                "question": question,
                "subject": [subject] if subject else [],
                "use": [use] if use else [],
                "responses": liste_reponses,
                "corrects": liste_corrects,
                "remark": remark,
            }

            # Mise en cache
            questions_cache[question_key] = cleaned_row

    # Retour des questions uniques
    for question_data in questions_cache.values():
        yield question_data


# --- Connexion MongoDB ---
def make_mongo_client() -> MongoClient:
    """
    Construit un client MongoDB à partir des variables d'environnement.
    Utilise l'auth si user/password fournis, sinon connexion simple host:port.
    """
    host = MONGO_HOST
    port = MONGO_PORT

    # if MONGO_USERNAME and MONGO_PASSWORD:
    #    uri = f"mongodb://{MONGO_USERNAME}:{MONGO_PASSWORD}@{host}:{port}"
    # else:
    uri = f"mongodb://{host}:{port}"

    return MongoClient(uri, serverSelectionTimeoutMS=8000)


# --- Insertions par lots ---
def insert_documents(collection, documents: Iterator[dict]) -> int:
    """
    Insère les documents par lots.
    Retourne le nombre total inséré.
    """
    batch = []
    total_inserted = 0

    def flush_batch():
        nonlocal batch, total_inserted
        if not batch:
            return
        try:
            result = collection.insert_many(batch, ordered=False)
            total_inserted += len(result.inserted_ids)
        except BulkWriteError as bwe:
            ok = bwe.details.get("nInserted", 0)
            total_inserted += ok
            print(
                f"BulkWriteError: {ok} insérés avant erreur, détails resumés: {bwe.details.get('writeErrors', [])[:3]}"
            )
        finally:
            batch = []

    for doc in documents:
        batch.append(doc)
        if len(batch) >= BATCH_SIZE:
            flush_batch()

    flush_batch()
    return total_inserted


# --- Programme principal ---
def populate_mongo():
    print(f"Source CSV: {CSV_SOURCE}")
    print(f"DB: {DB_NAME} / Collection: {COLLECTION_NAME}")
    print(f"Batch size: {BATCH_SIZE}")
    if SUBJECT_FIX_ENABLED:
        print(f"Correction de 'subject' activée (seuil={SUBJECT_SEUIL:.2f})")
    else:
        print("Correction de 'subject' désactivée")

    try:
        client = make_mongo_client()
        client.admin.command("ping")

        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]

        documents = read_csv_rows(
            CSV_SOURCE,
            fix_subjects=SUBJECT_FIX_ENABLED,
            subject_seuil=SUBJECT_SEUIL,
        )

        total = insert_documents(collection, documents)
        print(f"Terminé. {total} documents insérés.")

    except FileNotFoundError:
        print(f"Fichier CSV introuvable: {CSV_SOURCE}")
        sys.exit(1)
    except ServerSelectionTimeoutError as e:
        print("Connexion MongoDB impossible (timeout).")
        print(str(e))
        sys.exit(2)
    except Exception as e:
        print(f"Erreur: {e}")
        sys.exit(3)
    finally:
        try:
            client.close()
        except Exception:
            pass


if __name__ == "__main__":
    print("Lancement de Mongo Populate...")
    populate_mongo()
