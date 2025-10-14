# Questions Quiz Frontend — Flask + Vanilla JS

Ce dépôt contient le frontend de l'application de gestion de quiz. L'interface est construite avec Flask pour servir les templates HTML et JavaScript Vanilla pour la logique client. L'architecture suit le pattern Single Page Application (SPA) avec navigation par onglets et composants réutilisables.

## 1. Présentation

Le frontend offre une interface web pour :

- Gérer les questions de quiz (création, modification, suppression)
- Gérer les questionnaires (création, ajout de questions, export)
- Afficher et passer des questionnaires
- Importer des questions depuis CSV
- S'authentifier et gérer sa session

L'accès aux fonctionnalités est contrôlé par rôle via token JWT stocké en session Flask. Les étudiants ont un accès limité aux questionnaires, tandis que les enseignants et administrateurs peuvent gérer l'ensemble des ressources.

## 2. Architecture

Organisation du répertoire `frontend/` :

```
frontend/
├─ app.py
├─ static/
│  ├─ assets/
│  │  ├─ miskatonic.png
│  │  ├─ bart.png
│  │  ├─ krapabel.png
│  │  └─ icon-logout.svg
│  ├─ scripts/
│  │  ├─ question/
│  │  │  ├─ index.js
│  │  │  ├─ modal-manager.js
│  │  │  ├─ q-manager.js
│  │  │  ├─ question-index.js
│  │  │  ├─ question-manager.js
│  │  │  ├─ question-modale-manager.js
│  │  │  ├─ response-manager.js
│  │  │  └─ select-manager.js
│  │  ├─ questionnaire/
│  │  │  ├─ api-service.js
│  │  │  ├─ qr-manager.js
│  │  │  ├─ questionnaire-detail.js
│  │  │  ├─ questionnaire-index.js
│  │  │  ├─ questionnaire-manager.js
│  │  │  ├─ questionnaire-modale-maanger.js
│  │  │  ├─ questionnaire-modale-manager.js
│  │  │  ├─ questionnaire-table-utils.js
│  │  │  └─ questionnaire-validator.js
│  │  ├─ utils/
│  │  │  ├─ api-service.js
│  │  │  ├─ form-validator.js
│  │  │  ├─ managers-utils.js
│  │  │  ├─ response-manager.js
│  │  │  ├─ select-manager.js
│  │  │  └─ utils.js
│  │  ├─ login.js
│  │  ├─ quizz.js
│  │  └─ table.js
│  └─ styles/
│     └─ style.css
├─ templates/
│  ├─ base.html
│  ├─ login1.html
│  ├─ page_error.html
│  ├─ page_quizz.html
│  ├─ question-modale.html
│  ├─ question.html
│  ├─ questionnaire-detail.html
│  ├─ questionnaire-modale.html
│  ├─ questionnaire.html
│  ├─ tst.html
│  └─ upload_csv.html
└─ utils/
   ├─ decorators.py
   └─ utils.py
```

`app.py` crée l'application Flask, configure les sessions, gère les routes et l'authentification.  
`templates/base.html` contient les composants réutilisables (navbar, footer) et la structure HTML commune.  
`templates/` regroupe les pages HTML de l'application.  
`static/scripts/` contient les scripts JavaScript organisés par fonctionnalité avec séparation des responsabilités (index, managers, validators).  
`static/scripts/utils/` mutualise le code commun (API calls, validation, utilitaires).  
`static/styles/` contient les feuilles de style CSS custom (pas de framework).  
`utils/` regroupe les décorateurs Python et utilitaires côté serveur.

## 3. Fonctionnement

### 3.1 Single Page Application

L'application fonctionne comme une SPA avec navigation par onglets. Flask sert les templates HTML qui sont enrichis dynamiquement par JavaScript Vanilla. Les onglets disponibles dépendent du rôle de l'utilisateur :

**Étudiants (STUDENT)** :

- Afficher le questionnaire

**Enseignants et Administrateurs (TEACHER, ADMIN)** :

- Gérer les questions
- Gérer les questionnaires
- Afficher le questionnaire

### 3.2 Authentification et Sessions

L'authentification se fait via JWT. Le token est stocké dans une session Flask (cookie côté client) après connexion. Chaque requête vers l'API backend inclut ce token pour vérifier les permissions.

La navbar affiche dynamiquement les onglets accessibles selon le rôle de l'utilisateur. Un décorateur côté serveur protège les routes selon les permissions.

### 3.3 Organisation JavaScript

Les scripts JavaScript sont organisés selon un pattern de séparation des responsabilités :

- `index.js` : Point d'entrée, initialisation de la page
- `*-manager.js` : Gestion de la logique métier et des interactions
- `*-validator.js` : Validation des formulaires
- `api-service.js` : Communication avec l'API backend
- `utils.js` : Fonctions utilitaires réutilisables

Cette organisation évite les redondances et facilite la maintenance.

## 4. Prérequis

Python 3.12 ou plus récent. Flask 3.1.2 est utilisé sans extensions additionnelles. Aucune dépendance JavaScript externe (Vanilla JS uniquement).

## 5. Installation

Création d'un environnement virtuel et installation des dépendances :

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 6. Configuration

Les paramètres s'effectuent via des variables d'environnement et peuvent être stockés dans un fichier `.env` chargé au démarrage. Un template `.env.template` est présent à la racine du projet.

Configuration Flask nécessaire :

- `SECRET_KEY` : Clé secrète pour signer les sessions
- `API_BASE_URL` : URL de l'API backend (par défaut http://localhost:8000)

## 7. Lancement en développement

Lancement depuis `frontend/` :

```bash
python3 app.py
```

L'application démarre sur `http://localhost:5005` par défaut.

## 8. Routes principales

### 8.1 Authentification

`GET /login` affiche la page de connexion.

`POST /login` authentifie l'utilisateur et stocke le JWT en session.

`GET /logout` déconnecte l'utilisateur et supprime la session.

### 8.2 Pages protégées

`GET /questions` affiche la page de gestion des questions (TEACHER, ADMIN uniquement).

`GET /questionnaires` affiche la page de gestion des questionnaires (TEACHER, ADMIN uniquement).

`GET /quizz` affiche la page de passage de questionnaire (tous les utilisateurs authentifiés).

Toutes les routes sont protégées par décorateur vérifiant la présence et la validité du JWT en session.

## 9. Composants réutilisables

Le template `base.html` inclut :

**Navbar** :

- Logo de l'application
- Navigation par onglets (affichage conditionnel selon rôle)
- Indicateur utilisateur avec avatar selon rôle
- Bouton de déconnexion

**Footer** :

- Informations de version
- Copyright

**Scripts communs** :

- Gestion de la navigation active
- Mise en évidence visuelle de l'onglet courant

Les pages étendent `base.html` et surchargent les blocks `title` et `content`.

## 10. Limitations version MVP

Cette version MVP ne propose pas encore :

- Page de gestion du profil utilisateur
- Interface d'administration (gestion des utilisateurs, des rôles)
- Fonctionnalités avancées de statistiques

Ces fonctionnalités sont prévues pour la V2.

## 11. Communication avec le backend

L'application communique avec l'API backend de deux manières :
**Côté client (JavaScript) :**

Les scripts utilisent `fetch` pour les appels asynchrones vers l'API
Les services API (`api-service.js`) centralisent les appels HTTP et gèrent automatiquement l'inclusion du token JWT depuis la session
Les réponses sont traitées par des managers dédiés qui mettent à jour l'interface dynamiquement sans rechargement de page

**Côté serveur (Flask) :**

Flask utilise la bibliothèque `requests` pour communiquer avec l'API backend
Certaines routes Flask agissent comme proxy pour récupérer des données avant de rendre les templates
Le token JWT est extrait de la session Flask et transmis dans les headers des requêtes

## 12. Style et design

L'interface utilise volontairement du CSS custom sans framework.
