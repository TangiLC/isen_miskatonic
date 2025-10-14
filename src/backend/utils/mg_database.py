import os
from pymongo import MongoClient
from dotenv import load_dotenv
from typing import Optional
import threading

load_dotenv()


class Database:
    """
    Classe pour gérer la connexion à MongoDB avec pymongo (version synchrone).
    Utilise des class methods pour un accès singleton.
    """

    _lock = threading.RLock()
    _client: Optional[MongoClient] = None
    _db = None
    _collection = None
    _mongo_username = None
    _mongo_password = None
    _mongo_host = None
    _mongo_port = None
    _db_name = None
    _collection_name = None
    _mongodb_uri = None

    @classmethod
    def _load_config(cls):
        """Charge la configuration depuis les variables d'environnement."""
        cls._mongo_username = os.getenv("MONGO_USERNAME")
        cls._mongo_password = os.getenv("MONGO_PASSWORD")
        cls._mongo_host = os.getenv("MONGO_HOST", "localhost")
        cls._mongo_port = os.getenv("MONGO_PORT", "27018")
        cls._db_name = os.getenv("DB_NAME", "miskatonic")
        cls._collection_name = os.getenv("COLLECTION_NAME", "questions")

        # if cls._mongo_username and cls._mongo_password:
        #    cls._mongodb_uri = f"mongodb://{cls._mongo_username}:{cls._mongo_password}@{cls._mongo_host}:{cls._mongo_port}/"
        # else:
        cls._mongodb_uri = f"mongodb://{cls._mongo_host}:{cls._mongo_port}/"

    @classmethod
    def init_db(cls):
        """
        Initialise la connexion à MongoDB (version synchrone).
        """
        with cls._lock:
            if cls._mongodb_uri is None:
                cls._load_config()

            print("Connexion à MongoDB...")
            print(f"   URI: {cls._mongodb_uri}")

            try:
                cls._client = MongoClient(
                    cls._mongodb_uri,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=5000,
                    maxPoolSize=10,
                    minPoolSize=1,
                )

                cls._client.admin.command("ping")
                print("Connexion MongoDB réussie")

                # Sélectionner la base et la collection
                cls._db = cls._client[cls._db_name]
                cls._collection = cls._db[cls._collection_name]

                print(f"Base de données: {cls._db_name}")
                print(f"Collection: {cls._collection_name}")

            except Exception as e:
                print(f"Erreur connexion MongoDB: {e}")
                raise

    @classmethod
    def close_db(cls):
        """
        Ferme la connexion à MongoDB (version synchrone).
        """
        with cls._lock:
            if cls._client:
                cls._client.close()
                cls._client = None
                cls._db = None
                cls._collection = None
                print("Connexion MongoDB fermée")

    @classmethod
    def ping(cls):
        """
        Teste la connexion à MongoDB (version synchrone).
        """
        if cls._client is None:
            raise Exception("Base de données non initialisée")

        try:
            cls._client.admin.command("ping")
            return True
        except Exception as e:
            print(f"Ping MongoDB échoué: {e}")
            return False

    @classmethod
    def get_database(cls):
        """
        Retourne l'instance de la base de données.
        """
        if cls._db is None:
            raise Exception("Base de données non initialisée")
        return cls._db

    @classmethod
    def get_collection(cls, collection_name: str = None):
        """
        Retourne une collection spécifique.
        """
        if cls._db is None:
            raise Exception("Base de données non initialisée")

        if collection_name:
            return cls._db[collection_name]
        return cls._collection

    @classmethod
    def get_collection_stats(cls):
        """
        Retourne les statistiques de la collection principale (version synchrone).
        """
        try:
            if cls._collection is None:
                raise Exception("Collection non initialisée")

            count = cls._collection.count_documents({})
            return {
                "database": cls._db_name,
                "collection": cls._collection_name,
                "document_count": count,
                "status": "connected",
            }
        except Exception as e:
            return {
                "database": cls._db_name,
                "collection": cls._collection_name,
                "error": str(e),
                "status": "error",
            }

    @classmethod
    def is_connected(cls) -> bool:
        """
        Vérifie si la connexion est active.
        """
        return cls._client is not None and cls.ping()


# Initialisation automatique
database = Database
