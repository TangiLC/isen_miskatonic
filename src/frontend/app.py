from pathlib import Path
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from werkzeug.exceptions import HTTPException
import requests
from typing import Optional, Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

# Configuration de l'API Backend
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

BASE_DIR = Path(__file__).resolve().parent

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "session_cookie_secret_key")


@app.context_processor
def inject_user():
    return {
        "user": {
            "isAuth": ("token" in session),
            "id": session.get("user_id"),
            "name": session.get("user_name"),
            "role": session.get("user_role"),
        }
    }


# ==================== API CLIENT HELPERS ====================


class APIClient:
    """Client pour communiquer avec l'API FastAPI"""

    @staticmethod
    def login(username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authentifie un utilisateur via l'API"""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/auth/login",
                json={"username": username, "password": password},
                timeout=5,
            )
            if response.status_code == 200:
                return response.json()
            return None
        except requests.RequestException as e:
            print(f"❌ Erreur API login: {e}")
            return None

    @staticmethod
    def register(name: str, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Crée un compte utilisateur via l'API"""
        try:
            response = requests.post(
                f"{API_BASE_URL}/api/auth/register",
                json={"name": name, "email": email, "password": password},
                timeout=5,
            )
            if response.status_code == 201:
                return response.json()
            return None
        except requests.RequestException as e:
            print(f"❌ Erreur API register: {e}")
            return None

    @staticmethod
    def get_user_name(user_id: int, token: str) -> str:
        """Récupère le nom d'un utilisateur via l'API"""
        try:
            response = requests.get(
                f"{API_BASE_URL}/api/auth/users/{user_id}/name",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
            if response.status_code == 200:
                return response.json().get("userName", "Inconnu")
            return "Inconnu"
        except requests.RequestException as e:
            print(f"❌ Erreur API get_user_name: {e}")
            return "Inconnu"


# ==================== DECORATORS ====================


def require_roles(*allowed_roles):
    """Décorateur pour vérifier les rôles utilisateur"""
    from functools import wraps

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            # Vérifier d'abord si l'utilisateur est connecté
            if "token" not in session or "user_role" not in session:
                return redirect(url_for("login"))

            user_role = session.get("user_role", "").upper()

            if user_role not in [r.upper() for r in allowed_roles]:
                return redirect(
                    url_for(
                        "page_error",
                        code=403,
                        message="Accès refusé : droits insuffisants.",
                    )
                )
            return f(*args, **kwargs)

        return wrapped

    return decorator


# ==================== ROUTES ====================


@app.route("/")
@app.route("/login")
def login():
    """Page de connexion"""
    return render_template("login1.html", showLoginForm=True)


@app.route("/register")
def register():
    """Page d'inscription"""
    return render_template("login1.html", showLoginForm=False)


@app.post("/login")
def authentifier():
    """Traite la connexion utilisateur"""
    try:
        data = request.form.to_dict()
        username = data.get("name", "").strip()
        password = data.get("password", "")

        if not username or not password:
            return render_template(
                "login1.html",
                showLoginForm=True,
                error="Nom d'utilisateur et mot de passe requis.",
            )

        # Appel à l'API FastAPI
        result = APIClient.login(username, password)

        if result and result.get("access_token"):
            user = result.get("user", {})
            token = result.get("access_token")

            # Stockage en session
            session["token"] = token
            session["user_id"] = user.get("id")
            session["user_name"] = user.get("name")
            session["user_role"] = user.get("role")
            session["current_questionnaire_id"] = None

            # Redirection selon le rôle
            role = user.get("role", "").upper()
            if role in ("ADMIN", "TEACHER"):
                return redirect(url_for("page_questions"))
            elif role == "STUDENT":
                return redirect(url_for("page_quizz"))
            else:
                return redirect(
                    url_for(
                        "page_error",
                        code=403,
                        message="Contacter un administrateur pour finaliser votre inscription",
                    )
                )
        else:
            return render_template(
                "login1.html",
                showLoginForm=True,
                error="Login ou mot de passe incorrect.",
            )

    except Exception as e:
        print(f"❌ Erreur dans /login: {e}")
        return render_template(
            "login1.html",
            showLoginForm=True,
            error="Erreur lors de l'authentification.",
        )


@app.post("/register")
def creer_compte():
    """Crée un compte utilisateur via l'API"""
    try:
        data = request.form.to_dict()
        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not name or not email or not password:
            return render_template(
                "login1.html",
                showLoginForm=False,
                error="Tous les champs sont requis.",
            )

        # Appel à l'API FastAPI
        result = APIClient.register(name, email, password)

        if result and result.get("access_token"):
            return render_template(
                "login1.html",
                showLoginForm=True,
                success="Compte créé avec succès ! Vous pouvez maintenant vous connecter.",
            )
        else:
            return render_template(
                "login1.html",
                showLoginForm=False,
                error="Impossible de créer le compte (email déjà utilisé ?).",
            )

    except Exception as e:
        print(f"❌ Erreur dans /register: {e}")
        return render_template(
            "login1.html",
            showLoginForm=False,
            error="Erreur lors de la création du compte.",
        )


@app.route("/questions")
@require_roles("ADMIN", "TEACHER")
def page_questions():
    """Page de gestion des questions"""
    questionnaire_id = session.get("current_questionnaire_id")
    token = session.get("token", "")
    return render_template(
        "question.html",
        token=token,
        questionnaire_id=questionnaire_id,
    )


@app.route("/questionnaire")
@require_roles("ADMIN", "TEACHER")
def page_questionnaire():
    """Page de gestion des questionnaires"""
    current_id = session.get("current_questionnaire_id")
    token = session.get("token", "")
    return render_template(
        "questionnaire.html",
        token=token,
        current_questionnaire_id=current_id,
    )


@app.route("/quizz")
def page_quizz():
    """Page de passage de quiz"""
    if "token" not in session:
        return redirect(url_for("login"))

    current_id = session.get("current_questionnaire_id")
    token = session.get("token", "")
    return render_template(
        "page_quizz.html",
        token=token,
        current_questionnaire_id=current_id,
    )


@app.post("/api/questionnaire/<string:qid>/select")
def select_questionnaire(qid):
    """Sélectionne un questionnaire en session"""
    if "token" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    session["current_questionnaire_id"] = qid
    return jsonify({"success": True, "questionnaire_id": qid})


@app.get("/api/users/<int:user_id>/name")
def get_user_name(user_id):
    """Récupère le nom d'un utilisateur via l'API"""
    if "token" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_name = APIClient.get_user_name(user_id, session["token"])
    return jsonify({"userName": user_name})


@app.route("/logout")
def logout():
    """Déconnecte l'utilisateur"""
    session.clear()
    return redirect(url_for("login"))


@app.route("/error")
def page_error():
    """Page d'erreur générique"""
    code = request.args.get("code", 404)
    message = request.args.get("message", "Dead Link !")
    return render_template("page_error.html", code=code, message=message)


@app.errorhandler(Exception)
def handle_exception(e):
    """Capture toutes les erreurs"""
    if isinstance(e, HTTPException):
        return (
            render_template("page_error.html", code=e.code, message=e.description),
            e.code,
        )
    return (
        render_template("page_error.html", code=500, message="Erreur interne."),
        500,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005, debug=True)
