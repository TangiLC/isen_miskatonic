// index.js - Point d'entrée principal pour l'application Question Manager
// Ce fichier centralise tous les imports et initialise l'application

import { QuestionManager } from './question-manager.js';
import { Utils } from './utils.js';
import { ApiService } from './api-service.js';
import { SelectManager } from './select-manager.js';
import { ResponseManager } from './response-manager.js';
import { FormValidator } from './form-validator.js';
import { ModalManager } from './modal-manager.js';

// Exposition globale des classes pour débogage et intégration
window.QuestionManagerModules = {
  QuestionManager,
  Utils,
  ApiService,
  SelectManager,
  ResponseManager,
  FormValidator,
  ModalManager
};

// Instance principale
let questionManagerInstance = null;

// Fonctions globales pour la compatibilité avec le code existant
window.see_details = async function(id) {
  if (questionManagerInstance) {
    await questionManagerInstance.viewQuestion(id);
  } else {
    console.error('QuestionManager non initialisé');
  }
};

window.edit_question = async function(id) {
  if (questionManagerInstance) {
    await questionManagerInstance.editQuestion(id);
  } else {
    console.error('QuestionManager non initialisé');
  }
};

window.add_to_quizz = async function(id) {
  if (questionManagerInstance) {
    await questionManagerInstance.addQuestionToQuiz(id);
  } else {
    console.error('QuestionManager non initialisé');
  }
};

// Initialisation automatique
document.addEventListener("DOMContentLoaded", () => {
  // Vérifier qu'on est sur la bonne page
  if (document.getElementById("question-detail") || document.getElementById("question-modal")) {
    try {
      questionManagerInstance = new QuestionManager();

      // Exposer l'instance globalement pour débogage/intégration
      window.questionManager = questionManagerInstance;
      
      console.log('QuestionManager initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du QuestionManager:', error);
    }
  }
});

// Export pour usage en tant que module
export { QuestionManager };
export default QuestionManager;