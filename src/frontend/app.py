from pathlib import Path
from flask import Flask, jsonify, redirect, render_template, request, session, url_for

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
    return render_template("login1.html", showLoginForm=True)


@app.route("/register")
def register():
    return render_template("login1.html", showLoginForm=False)


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
            print("User OK:", authenticated_user, token)
            session["token"] = token
            session["user_id"] = authenticated_user.id

            return redirect(url_for("page_questions"))
        else:
            error_message = "Login ou mot de passe incorrect."
            return render_template(
                "login1.html", showLoginForm=True, error=error_message
            )

    except Exception as e:
        print(f"Erreur dans /login: {e}")
        error_message = "Erreur lors de l'authentification."
        return render_template("login1.html", showLoginForm=True, error=error_message)


@app.post("/register")
def creer_compte():
    try:
        data = request.form.to_dict()
        data.setdefault("role", "user")
        data.setdefault("isAuth", False)

        if not data.get("name") or not data.get("email") or not data.get("password"):
            error_message = "Tous les champs sont requis."
            return render_template(
                "login1.html", showLoginForm=False, error=error_message
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
                "login1.html",
                showLoginForm=False,
                error="Impossible de créer le compte (email déjà utilisé ?).",
            )

        success_message = (
            "Compte créé avec succès ! Vous pouvez maintenant vous connecter."
        )
        return render_template(
            "login1.html", showLoginForm=True, success=success_message
        )

    except Exception as e:
        print(f"[DEBUG] Erreur dans creer_compte: {e}")
        return render_template(
            "login1.html",
            showLoginForm=False,
            error="Erreur inattendue lors de la création du compte.",
        )

    except Exception as e:
        print(f"Erreur dans /register: {e}")
        error_message = "Erreur lors de la création du compte."
        return render_template("login1.html", showLoginForm=False, error=error_message)


@app.route("/questions")
def page_questions():
    if "token" not in session:
        return redirect(url_for("login"))
    utilisateur = Service.get_user_from_token(session["token"])
    questionnaire_id = session.get("current_questionnaire_id")
    print(f"current_questionnaire_id:{questionnaire_id}")
    utilisateur.isAuth
    return render_template(
        "question.html",
        user=utilisateur,
        token=session["token"],
        questionnaire_id=questionnaire_id,
    )


@app.route("/questionnaire")
def page_questionnaire():
    if "token" not in session:
        return redirect(url_for("login"))
    utilisateur = Service.get_user_from_token(session["token"])
    current_id = session.get("current_questionnaire_id")
    print(f"current_questionnaire_id:{current_id}")
    utilisateur.isAuth
    return render_template(
        "questionnaire.html",
        user=utilisateur,
        token=session["token"],
        current_questionnaire_id=current_id,
    )


@app.post("/api/questionnaire/<string:qid>/select")
def select_questionnaire(qid):
    if "token" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    session["current_questionnaire_id"] = qid
    return jsonify({"success": True, "questionnaire_id": qid})


@app.get("/api/users/<int:user_id>/name")
def get_user_name(user_id):
    user_name = Service.get_user_name(user_id)
    return jsonify({"userName": user_name})


@app.route("/logout")
def logout():
    """Déconnecte l'utilisateur en nettoyant la session"""
    session.clear()
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005, debug=True)
