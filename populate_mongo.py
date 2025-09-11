import os
import csv
from pymongo import MongoClient
from dotenv import load_dotenv

# Charge le fichier .env
load_dotenv()

# Configuration
MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27018")
DB_NAME = os.getenv("DB_NAME", "miska")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "questions")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))
CSV_SOURCE = os.getenv("CSV_SOURCE", "./source/questions.csv")

MONGODB_URI = f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"


def read_csv_rows(file_path: str):
    """Lit le CSV et retourne les lignes nettoyées"""
    with open(file_path, "r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            cleaned_row = {}

            # Parcourt chaque colonne de la ligne
            for column_name, cell_value in row.items():

                # Vérifie que le nom de colonne existe et n'est pas vide
                if column_name and column_name.strip():
                    clean_column_name = column_name.strip()

                    # Nettoie la valeur de la cellule
                    if cell_value and cell_value.strip():
                        clean_cell_value = cell_value.strip()
                    else:
                        clean_cell_value = None

                    # Ajoute au dictionnaire nettoyé
                    cleaned_row[clean_column_name] = clean_cell_value

            # Ne retourne que les lignes qui ont des données
            if cleaned_row:
                yield cleaned_row


def insert_documents(collection, documents):
    """Insère les documents par lots"""
    batch = []
    total_inserted = 0

    for doc in documents:
        batch.append(doc)
        if len(batch) >= BATCH_SIZE:
            result = collection.insert_many(batch, ordered=False)
            total_inserted += len(result.inserted_ids)
            batch.clear()

    # Insère le dernier lot s'il reste des documents
    if batch:
        result = collection.insert_many(batch, ordered=False)
        total_inserted += len(result.inserted_ids)

    return total_inserted


def main():
    print(f"🔗 Connexion à MongoDB (sans authentification)...")
    print(f"   URI: {MONGODB_URI}")

    try:
        # Connexion à MongoDB
        client = MongoClient(MONGODB_URI)

        # Test de connexion
        client.admin.command("ping")
        print("✅ Connexion MongoDB réussie")

        collection = client[DB_NAME][COLLECTION_NAME]

        # Lecture et insertion
        print(f"📖 Lecture du fichier: {CSV_SOURCE}")
        documents = read_csv_rows(CSV_SOURCE)
        count = insert_documents(collection, documents)

        print(f"✅ Insérés: {count} documents dans {DB_NAME}.{COLLECTION_NAME}")

    except FileNotFoundError:
        print(f"❌ Fichier CSV introuvable: {CSV_SOURCE}")
    except Exception as e:
        print(f"❌ Erreur: {e}")
        if "Connection refused" in str(e):
            print("\n🔧 Solutions:")
            print("1. Démarrez MongoDB: docker-compose up -d")
            print("2. Vérifiez le statut: docker-compose ps")
    finally:
        if "client" in locals():
            client.close()


if __name__ == "__main__":
    main()
