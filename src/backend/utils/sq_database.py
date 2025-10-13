import sqlite3
import os


class Connection:
    connexion = None
    cursor = None

    @classmethod
    def connect(cls):
        if cls.connexion is None:
            try:
                current_dir = os.path.dirname(os.path.abspath(__file__))
                if "src" in current_dir:
                    src_index = current_dir.find("src")
                    src_dir = current_dir[: src_index + 3]
                    db_dir = os.path.join(src_dir, "db")
                else:
                    parent_dir = os.path.dirname(current_dir)
                    db_dir = os.path.join(parent_dir, "db")

                db_path = os.path.join(db_dir, "utilisateurs.db")

                src_dir = os.path.dirname(db_dir)

                cls.connexion = sqlite3.connect(db_path)
                cls.connexion.row_factory = sqlite3.Row

                cls.connexion.execute("SELECT 1").fetchone()
                print("Base de données SQLite connectée")

            except sqlite3.Error as e:
                print(f"Erreur BDD SQLite: {e}")
                cls.connexion = None
                raise
            except Exception as e:
                print(f"Erreur de connexion BDD SQLite: {e}")
                cls.connexion = None
                raise

        if cls.cursor is None and cls.connexion is not None:
            cls.cursor = cls.connexion.cursor()

    @classmethod
    def close(cls):
        if cls.cursor is not None:
            cls.cursor.close()
            cls.cursor = None
        if cls.connexion is not None:
            cls.connexion.close()
            cls.connexion = None
