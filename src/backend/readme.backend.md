# Questions Quiz API — FastAPI + MongoDB (PyMongo)

Ce dépôt contient une API FastAPI pour gérer des questions de quiz stockées dans MongoDB via PyMongo. L’API est asynchrone côté front et utilise des adaptateurs pour exécuter les opérations MongoDB synchrones dans un pool de threads. L’architecture sépare les couches application, service et accès aux données afin de faciliter l’évolution et les tests.

## 1. Présentation

L’API expose des points d’entrée pour :
• consulter une question par identifiant MongoDB ;
• Créer, Modifier, Supprimer une question ;
•

Le serveur s’appuie sur FastAPI. La connexion à MongoDB se fait via PyMongo.

## 2. Architecture

Organisation du répertoire `backend/` :

```
backend/
├─ api.py
├─ routers/
│  └─ questions.py
├─ services/
│  └─ question_service.py
├─ repositories/
│  └─ question_repository.py
├─ models/
│  └─ question.py
├─ schemas/
│  └─ question.py
├─ utils/
│  └─ database.py
└─ tests/
```

`api.py` crée l’application, configure CORS, gère le cycle de vie (startup/shutdown) et déclare les routes système.  
`routers` expose les routes HTTP liées aux questions et aux questionnaires.  
`services` contient la logique métier.  
`repositories` réalise les accès MongoDB via PyMongo et convertit les documents en modèles.  
`models` et `schemas` définissent respectivement les objets internes et les schémas Pydantic exposés par l’API.

## 3. Prérequis

Python 3.12 ou plus récent et un serveur MongoDB accessible localement ou à distance. Un environnement virtuel Python est recommandé.

## 4. Installation

Création d’un environnement virtuel et installation des dépendances :

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 5. Configuration

Les paramètres s’effectuent via des variables d’environnement et peuvent être stockés dans un fichier `.env` chargé au démarrage. un template `.env.template` est présent à la racine du projet.

## 6. Lancement en développement

Lancement depuis `backend/` en conservant la structure de paquets :

```bash
python3 api.py
```

## 7. Endpoints

Le projet est documenté avec OpenAPI/Swagger, qui peut être consulté sur `localhost:8000/docs`

### 7.1 Système

`GET /` retourne un message d’accueil, la version et le statut du service.

### 7.2 Questions

`GET /api/question?{id}` récupère une question par identifiant.

## 8. Tests

Les tests unitaires et d’intégration peuvent être placés dans `backend/tests/`. Exemple d’exécution :

```bash
pytest -q
```
