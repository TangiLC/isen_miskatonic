// questionnaire/index.js - Point d'entrée principal pour la gestion des questionnaires
import { QuestionnaireManager } from './questionnaire-manager.js'

let questionnaireManagerInstance = null

function initializeQuestionnaireManager () {
  const isQuestionnairePage = document.getElementById('questionnairesTable')

  if (!isQuestionnairePage) {
    console.info(
      'Page sans gestion de questionnaires - QuestionnaireManager non initialisé'
    )
    return
  }

  try {
    questionnaireManagerInstance = new QuestionnaireManager()

    // Exposer globalement
    window.questionnaireManager = questionnaireManagerInstance
    console.log('QuestionnaireManager initialisé avec succès')

    // Fonctions globales pour compatibilité avec les boutons HTML
    window.view_questionnaire = id =>
      questionnaireManagerInstance.openQuestionnaireModal('view', id)
    window.edit_questionnaire = id =>
      questionnaireManagerInstance.openQuestionnaireModal('edit', id)
    window.create_questionnaire = () =>
      questionnaireManagerInstance.openQuestionnaireModal('create')
  } catch (error) {
    console.error(
      "Erreur lors de l'initialisation du QuestionnaireManager:",
      error
    )
  }
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', initializeQuestionnaireManager)

export { QuestionnaireManager }
export default QuestionnaireManager
