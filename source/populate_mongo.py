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
DB_NAME = os.getenv("DB_NAME", "miska")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "questions")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))
CSV_SOURCE = os.getenv("CSV_SOURCE", "../../source/questions.csv")

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

    txt = v.strip()
    if not txt:
        return []
    txt = txt.replace(",", " ").replace("-", " ")
    parts = [p for p in txt.split() if p]

    return parts


# --- Lecture CSV + nettoyage + correction des subjects ---
def read_csv_rows(
    file_path: str, fix_subjects: bool = True, subject_seuil: float = 0.90
) -> Iterator[dict]:
    """
    Lecture CSV avec nettoyage:
    - supprime espaces en trop
    - 'correct' -> normalisation
    - 'subject' -> rapprochement /correction typo
    """
    subjects_count: Dict[str, int] = {}

    with open(file_path, "r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            return

        for row in reader:
            cleaned_row: Dict[str, Any] = {}

            for column_name, cell_value in row.items():
                if not column_name:
                    continue
                key = column_name.strip()
                val = strip_or_none(cell_value)

                if key == "correct":
                    val = normalize_correct(val)

                if fix_subjects and key == "subject" and val:
                    canon = canonicalize_subject(
                        val, subjects_count, seuil=subject_seuil
                    )
                    val = canon
                    subjects_count[canon] = subjects_count.get(canon, 0) + 1

                cleaned_row[key] = val

            if cleaned_row:
                yield cleaned_row


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


populate_mongo()
