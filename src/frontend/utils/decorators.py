from functools import wraps
from flask import session, redirect, url_for
from services.services import Service


def require_roles(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if "token" not in session:
                return redirect(url_for("login"))
            utilisateur = Service.get_user_from_token(session["token"])
            if not utilisateur:
                return redirect(url_for("login"))
            role = (
                utilisateur.role.value
                if hasattr(utilisateur.role, "value")
                else utilisateur.role
            ).upper()
            if role not in [r.upper() for r in allowed_roles]:

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
