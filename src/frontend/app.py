from pathlib import Path
from flask import Flask, render_template, request, session

from services.services import Service
from models.user import User

BASE_DIR = Path(__file__).resolve().parent

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)
app.secret_key = "session_cookie_secret_key"  # stockage cookie session


@app.route("/")
@app.route("/login")
def login():
    """Affiche le formulaire de connexion"""
    return render_template("login.html", showLoginForm=True)


@app.route("/register")
def register():
    """Affiche le formulaire de création de compte"""
    return render_template("login.html", showLoginForm=False)


@app.post("/login")
def authentifier():
    """Traite la connexion utilisateur"""
    try:
        data = request.form.to_dict()
        data.setdefault("role", "user")
        data.setdefault("email", "test@test.com")
        data.setdefault("id", "1")
        data.setdefault("isAuth", False)
        utilisateur = User.model_validate(data)
        authenticated_user, token = Service.authentifier(utilisateur)

        if authenticated_user and token:
            print("User OK:", authenticated_user)
            session["token"] = token
            session["user_id"] = authenticated_user.id

            return render_template("welcome.html", user=authenticated_user)
        else:
            error_message = "Login ou mot de passe incorrect."
            return render_template(
                "login.html", showLoginForm=True, error=error_message
            )

    except Exception as e:
        print(f"Erreur dans /login: {e}")
        error_message = "Erreur lors de l'authentification."
        return render_template("login.html", showLoginForm=True, error=error_message)


@app.post("/register")
def creer_compte():
    try:
        data = request.form.to_dict()
        data.setdefault("role", "user")
        data.setdefault("isAuth", False)

        if not data.get("name") or not data.get("email") or not data.get("password"):
            error_message = "Tous les champs sont requis."
            return render_template(
                "login.html", showLoginForm=False, error=error_message
            )
        utilisateur = User(
            name=data["name"].strip(),
            email=data["email"].strip().lower(),
            password=data["password"],
        )

        # Appel au service de création
        created_user = Service.create_account(utilisateur)

        if created_user is None:
            # Soit l’utilisateur existe déjà, soit erreur BDD
            return render_template(
                "login.html",
                showLoginForm=False,
                error="Impossible de créer le compte (email déjà utilisé ?).",
            )

        success_message = (
            "Compte créé avec succès ! Vous pouvez maintenant vous connecter."
        )
        return render_template(
            "login.html", showLoginForm=True, success=success_message
        )

    except Exception as e:
        print(f"[DEBUG] Erreur dans creer_compte: {e}")
        return render_template(
            "login.html",
            showLoginForm=False,
            error="Erreur inattendue lors de la création du compte.",
        )

    except Exception as e:
        print(f"Erreur dans /register: {e}")
        error_message = "Erreur lors de la création du compte."
        return render_template("login.html", showLoginForm=False, error=error_message)


if __name__ == "__main__":
    app.run(debug=True)
