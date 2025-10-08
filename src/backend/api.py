from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from typing import Dict, Any
from datetime import datetime

from routers import questions
from routers import auth
from routers import questionnaires
from utils.mg_database import database


class QuizAPI:
    """
    Classe principale de l'application Quiz API.
    Adaptée pour utiliser pymongo (synchrone) avec FastAPI (asynchrone).
    """

    def __init__(self):
        self.app = None

    def startup(self):
        """
        Initialisation de l'application au démarrage (version synchrone).
        """
        print("Démarrage de l'application...")
        database.init_db()
        print("Application initialisée")

    def shutdown(self):
        """
        Nettoyage de l'application à l'arrêt (version synchrone).
        """
        print("Arrêt de l'application...")
        database.close_db()
        print("Application fermée")

    @asynccontextmanager
    async def lifespan(self, app: FastAPI):
        """
        Gestionnaire du cycle de vie de l'application.
        Utilise des fonctions synchrones dans un contexte async.
        """
        try:
            self.startup()
            yield
        finally:
            self.shutdown()

    def create_app(self) -> FastAPI:
        """
        Crée et configure l'instance FastAPI.
        """
        app = FastAPI(
            title="Questions Quiz API",
            description="API pour la gestion des questions de quiz avec PyMongo",
            version="1.0.0",
            lifespan=self.lifespan,
            docs_url="/docs",
            redoc_url="/redoc",
        )

        # Configuration CORS
        app.add_middleware(
            CORSMiddleware,
            # allow_origins=["http://localhost:5005", "http://localhost:8000"],
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["*"],
        )

        self._setup_exception_handlers(app)

        self._setup_base_routes(app)

        self._setup_routers(app)

        self.app = app
        return app

    def _setup_exception_handlers(self, app: FastAPI):
        """
        Configure les gestionnaires d'exceptions.
        """

        @app.exception_handler(HTTPException)
        async def http_exception_handler(request, exc: HTTPException):
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": {
                        "code": exc.status_code,
                        "message": exc.detail,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                },
            )

        @app.exception_handler(Exception)
        async def general_exception_handler(request, exc: Exception):
            print(f"Erreur non gérée: {exc}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": 500,
                        "message": "Erreur interne du serveur",
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                },
            )

    def _setup_base_routes(self, app: FastAPI):
        """
        Configure les routes de base.
        """

        @app.get("/", summary="Point d'entrée de l'API", tags=["Système"])
        async def root() -> Dict[str, Any]:
            return {
                "message": "Questions Quiz API",
                "version": "1.0.0",
                "status": "active",
                "docs": "/docs",
                "database": "pymongo",
            }

    def _setup_routers(self, app: FastAPI):
        """
        Configure les routers de l'application.
        """
        app.include_router(questions.router, tags=["Questions"])
        app.include_router(questionnaires.router, tags=["Questionnaires"])
        app.include_router(auth.router, tags=["Auth"])

    def run(self):
        """
        Lance l'application en mode développement.
        """
        print("Démarrage en mode développement avec PyMongo")
        uvicorn.run(
            self.app,
            host="0.0.0.0",
            port=8000,
            reload=False,
        )


# Instance globale de l'application
quiz_api = QuizAPI()
app = quiz_api.create_app()


if __name__ == "__main__":
    quiz_api.run()
