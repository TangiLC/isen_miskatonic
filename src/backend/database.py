import os
from pymongo import MongoClient
from dotenv import load_dotenv
from typing import Optional
import threading

load_dotenv()


class Database:
    """
    Classe pour gérer la connexion à MongoDB avec pymongo (version synchrone).
    """

    def __init__(self):
        self._lock = threading.RLock()
        self.mongo_username = os.getenv("MONGO_USERNAME")
        self.mongo_password = os.getenv("MONGO_PASSWORD")
        self.mongo_host = os.getenv("MONGO_HOST", "localhost")
        self.mongo_port = os.getenv("MONGO_PORT", "27018")
        self.db_name = os.getenv("DB_NAME", "miska")
        self.collection_name = os.getenv("COLLECTION_NAME", "questions")

        # if self.mongo_username and self.mongo_password:
        #    self.mongodb_uri = f"mongodb://{self.mongo_username}:{self.mongo_password}@{self.mongo_host}:{self.mongo_port}/"
        # else:
        self.mongodb_uri = f"mongodb://{self.mongo_host}:{self.mongo_port}/"

        # Instances de connexion
        self.client: Optional[MongoClient] = None
        self.db = None
        self.collection = None

    def init_db(self):
        """
        Initialise la connexion à MongoDB (version synchrone).
        """
        with self._lock:
            print("Connexion à MongoDB...")
            print(f"   URI: {self.mongodb_uri}")

            try:
                self.client = MongoClient(
                    self.mongodb_uri,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=5000,
                    maxPoolSize=10,
                    minPoolSize=1,
                )

                self.client.admin.command("ping")
                print("Connexion MongoDB réussie")

                # Sélectionner la base et la collection
                self.db = self.client[self.db_name]
                self.collection = self.db[self.collection_name]

                print(f"Base de données: {self.db_name}")
                print(f"Collection: {self.collection_name}")

            except Exception as e:
                print(f"Erreur connexion MongoDB: {e}")
                raise

    def close_db(self):
        """
        Ferme la connexion à MongoDB (version synchrone).
        """
        with self._lock:
            if self.client:
                self.client.close()
                self.client = None
                self.db = None
                self.collection = None
                print("Connexion MongoDB fermée")

    def ping(self):
        """
        Teste la connexion à MongoDB (version synchrone).
        """
        if self.client is None:
            raise Exception("Base de données non initialisée")

        try:
            self.client.admin.command("ping")
            return True
        except Exception as e:
            print(f"Ping MongoDB échoué: {e}")
            return False

    def get_database(self):
        """
        Retourne l'instance de la base de données.
        """
        if self.db is None:
            raise Exception("Base de données non initialisée")
        return self.db

    def get_collection(self, collection_name: str = None):
        """
        Retourne une collection spécifique.
        """
        if self.db is None:
            raise Exception("Base de données non initialisée")

        if collection_name:
            return self.db[collection_name]
        return self.collection

    def get_collection_stats(self):
        """
        Retourne les statistiques de la collection principale (version synchrone).
        """
        try:
            if self.collection is None:
                raise Exception("Collection non initialisée")

            count = self.collection.count_documents({})
            return {
                "database": self.db_name,
                "collection": self.collection_name,
                "document_count": count,
                "status": "connected",
            }
        except Exception as e:
            return {
                "database": self.db_name,
                "collection": self.collection_name,
                "error": str(e),
                "status": "error",
            }

    def is_connected(self) -> bool:
        """
        Vérifie si la connexion est active.
        """
        return self.client is not None and self.ping()


# Instance globale
database = Database()
