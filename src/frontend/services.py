from backend.models.user import User
from connexion import Connection


class Service(Connection):
    @classmethod
    def authentifier(cls, utilisateur: User):
        try:
            cls.connect()
            values = (utilisateur.name, utilisateur.password)
            query = "SELECT * FROM utilisateurs WHERE name=%s AND password=%s"
            cls.cursor.execute(query, values)
            result = cls.cursor.fetchone()
            print("Auth", result)
            if result:
                utilisateur.isAuth = True
                utilisateur.id = result["id"]
        except Exception as err:
            print(f"Erreur de connexion BDD: {err}")
            utilisateur.isAuth = False
        finally:
            cls.close()
