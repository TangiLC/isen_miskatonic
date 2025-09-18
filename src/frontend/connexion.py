import sqlite3


class Connection:
    connexion = None
    cursor = None

    @classmethod
    def connect(cls):

        if cls.connexion is None:
            cls.connexion = sqlite3.connect("../db/utilisateurs.db")
            cls.connexion.row_factory = sqlite3.Row
        if cls.cursor is None:
            cls.cursor = cls.connexion.cursor()

    @classmethod
    def close(cls):

        if cls.cursor is not None:
            cls.cursor.close()

        if cls.connexion is not None:
            cls.connexion.close()
