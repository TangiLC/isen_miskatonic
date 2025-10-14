# Questions Quiz API — FastAPI + MongoDB (PyMongo) et SQLite

Ce dépôt contient une API FastAPI pour gérer des questions et questionnaires de quiz stockés dans MongoDB via PyMongo, avec une gestion des utilisateurs dans SQLite. L'API est asynchrone côté front et utilise des adaptateurs pour exécuter les opérations MongoDB synchrones dans un pool de threads. L'architecture sépare les couches application, service et accès aux données afin de faciliter l'évolution et les tests.

## 1. Présentation

L'API expose des points d'entrée pour :

- Créer, Lire, Modifier, Supprimer des questions de quiz
- Créer, Lire, Modifier, Supprimer des questionnaires
- Importer des questions en masse depuis CSV
- Gérer l'authentification et les utilisateurs avec JWT
- Consulter une question ou un questionnaire par identifiant MongoDB

Le serveur s'appuie sur FastAPI. La connexion à MongoDB se fait via PyMongo pour les questions et questionnaires. Les utilisateurs sont stockés dans une base SQLite avec authentification JWT et hachage des mots de passe via bcrypt.

## 2. Architecture

Organisation du répertoire `backend/` :

```
backend/
├─ api.py
├─ routers/
│  ├─ questions.py
│  ├─ questionnaires.py
│  └─ auth.py
├─ services/
│  ├─ question_service.py
│  ├─ questionnaire_service.py
│  ├─ csv_import_service.py
│  └─ user_service.py
├─ repositories/
│  ├─ question_repository.py
│  ├─ questionnaire_repository.py
│  └─ user.py
├─ models/
│  ├─ question.py
│  ├─ questionnaire.py
│  └─ user.py
├─ schemas/
│  ├─ question.py
│  ├─ questionnaire.py
│  └─ user.py
├─ utils/
│  ├─ database.py
│  ├─ decorators.py
│  ├─ img_database.py
│  ├─ security.py
│  └─ sq_database.py
└─ tests/
```

`api.py` crée l'application, configure CORS, gère le cycle de vie (startup/shutdown) et déclare les routes système.  
`routers` expose les routes HTTP liées aux questions, questionnaires et authentification.  
`services` contient la logique métier.  
`repositories` réalise les accès MongoDB via PyMongo et SQLite pour les utilisateurs, et convertit les documents en modèles.  
`models` et `schemas` définissent respectivement les objets internes et les schémas Pydantic exposés par l'API.  
`utils` regroupe les utilitaires pour la connexion aux bases de données, la sécurité JWT et les décorateurs.

## 3. Bases de données

### 3.1 MongoDB (PyMongo)

MongoDB stocke les collections `questions` et `questionnaires`. Chaque document possède un identifiant MongoDB généré automatiquement, des métadonnées de création et modification, ainsi que l'identifiant du créateur.

### 3.2 SQLite

SQLite stocke les utilisateurs et leurs rôles. Le schéma est défini comme suit :

```sql
CREATE TABLE IF NOT EXISTS Roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    FOREIGN KEY (role_id) REFERENCES Roles(id)
);
```

Les rôles disponibles sont : `admin`, `teacher`, `student`, `user`.

Les mots de passe sont hachés avec bcrypt avant stockage. L'authentification se fait via JWT (JSON Web Token) avec une durée de validité de 60 minutes.

## 4. Prérequis

Python 3.12 ou plus récent et un serveur MongoDB accessible localement ou à distance. Un environnement virtuel Python est recommandé.

## 5. Installation

Création d'un environnement virtuel et installation des dépendances :

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 6. Configuration

Les paramètres s'effectuent via des variables d'environnement et peuvent être stockés dans un fichier `.env` chargé au démarrage. Un template `.env.template` est présent à la racine du projet.

## 7. Lancement en développement

Lancement depuis `backend/` en conservant la structure de paquets :

```bash
python3 api.py
```

## 8. Endpoints

Le projet est documenté avec OpenAPI/Swagger, qui peut être consulté sur `localhost:8000/docs`. Cette documentation interactive liste l'ensemble des routes disponibles, leurs paramètres et leurs schémas de réponse.

### 8.1 Système

`GET /` retourne un message d'accueil, la version et le statut du service.

### 8.2 Questions et Questionnaires

Exemples de routes disponibles :

`GET /api/question/{id}` récupère une question par identifiant MongoDB. Route sécurisée JWT. Les réponses correctes ne sont visibles que pour les rôles autorisés.

`PUT /api/questionnaire` crée un nouveau questionnaire à partir des données JSON fournies. Route sécurisée JWT.

`GET /api/questions` liste toutes les questions disponibles.

`GET /api/questionnaires` liste tous les questionnaires disponibles.

`PUT /api/questions/from_csv` importe des questions en masse depuis un fichier CSV. Route réservée aux rôles TEACHER et ADMIN.

Toutes les routes de manipulation des questions et questionnaires nécessitent une authentification JWT. Les opérations de modification et suppression sont réservées au créateur de la ressource.

### 8.3 Authentification

`POST /api/auth/register` crée un nouveau compte utilisateur avec email, nom et mot de passe. Le mot de passe est automatiquement haché avec bcrypt. Retourne un token JWT pour connexion automatique après inscription.

`POST /api/auth/login` authentifie un utilisateur avec son nom d'utilisateur et mot de passe. Vérifie le mot de passe haché en base de données. Retourne un token JWT valide 60 minutes.

`GET /api/auth/me` retourne les informations de l'utilisateur authentifié à partir du token JWT. Route sécurisée JWT.

`POST /api/auth/token` valide un token JWT et retourne les informations de l'utilisateur si le token est valide.

## 9. Sécurité

L'API utilise plusieurs mécanismes de sécurité :

- Authentification JWT avec tokens Bearer dans les headers HTTP
- Hachage des mots de passe avec bcrypt
- Validation des tokens avec vérification de signature et expiration
- Contrôle d'accès basé sur les rôles (RBAC) pour certaines opérations
- Vérification de propriété pour les opérations de modification et suppression

## 10. Tests

Les tests unitaires et d'intégration peuvent être placés dans `backend/tests/`. Exemple d'exécution :

```bash
pytest -q
```
