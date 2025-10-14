Miskatonic est une application web permettant de générer et de gérer des QCM (Questionnaires à Choix Multiples). Le backend est développé avec FastAPI pour sa rapidité et sa simplicité, 
tandis que le frontend utilise Flask pour une interface utilisateur intuitive.

## Fonctionnalités:

Génération automatique de QCM à partir de modèles prédéfinis.
Interface utilisateur pour la gestion des questions et des réponses.
API RESTful pour l'intégration avec d'autres systèmes.
Support de Docker pour une installation et un déploiement simplifiés.

## Lancement:

Pour exécuter le projet Miskatonic, il suffit d’abord de lancer la base de données MongoDB dans un conteneur Docker à l’aide de la commande `docker-compose up -d`.

Une fois la base en place, le fichier main.py permet de démarrer simultanément le backend FastAPI et le frontend Flask. 

Le serveur FastAPI, qui expose l’API RESTful et la documentation interactive OpenAPI, est accessible à l’adresse `http://localhost:8000/docs`
tandis que l’interface utilisateur est disponible sur `http://localhost:5000`

Cette configuration permet de gérer facilement les QCM via l’interface web tout en offrant une API intégrable à d’autres systèmes.

Prérequis:
Python 3.12
Docker
