import os
import csv
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27018")
DB_NAME = os.getenv("DB_NAME", "miska")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "questions")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))
CSV_SOURCE = os.getenv("CSV_SOURCE", "../../source/questions.csv")

MONGODB_URI = f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"


def normalize_correct(value):
    if not value:
        return None

    s = value.upper().replace(",", "")
    chars = []
    for ch in s:
        if not ch.isspace():  # " ", "\n", "\t"...
            chars.append(ch)
    return sorted(set(chars)) if chars else None


def read_csv_rows(file_path):
    with open(file_path, "r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            cleaned_row = {}

            for column_name, cell_value in row.items():
                if column_name and column_name.strip():
                    key = column_name.strip()

                    if cell_value and cell_value.strip():
                        val = cell_value.strip()
                    else:
                        val = None

                    if key == "correct":
                        val = normalize_correct(val)

                    cleaned_row[key] = val

            if cleaned_row:
                yield cleaned_row


def insert_documents(collection, documents):
    batch = []
    total_inserted = 0

    for doc in documents:
        batch.append(doc)
        if len(batch) >= BATCH_SIZE:
            result = collection.insert_many(batch, ordered=False)
            total_inserted += len(result.inserted_ids)
            batch.clear()

    if batch:
        result = collection.insert_many(batch, ordered=False)
        total_inserted += len(result.inserted_ids)

    return total_inserted


def populate_mongo():
    print("Connexion à MongoDB...")
    print(f"   URI: {MONGODB_URI}")

    try:
        client = MongoClient(MONGODB_URI)
        client.admin.command("ping")
        print("Connexion MongoDB réussie")

        collection = client[DB_NAME][COLLECTION_NAME]

        print(f"Lecture du fichier: {CSV_SOURCE}")
        documents = read_csv_rows(CSV_SOURCE)

        count = insert_documents(collection, documents)
        print(f"Insérés: {count} documents dans {DB_NAME}.{COLLECTION_NAME}")

    except FileNotFoundError:
        print(f"Fichier CSV introuvable: {CSV_SOURCE}")
    except Exception as e:
        print(f"Erreur: {e}")
        if "Connection refused" in str(e):
            print("\nSolutions:")
            print("1. Démarrez MongoDB: docker-compose up -d")
            print("2. Vérifiez le statut: docker-compose ps")
    finally:
        if "client" in locals():
            client.close()


populate_mongo()
