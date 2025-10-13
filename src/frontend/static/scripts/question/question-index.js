//import { QuestionManager } from './question-manager.js'
import { QuestionManager } from './q-manager.js'

let questionManagerInstance = null

function initializeQuestionManager () {
  const isQuestionPage =
    document.getElementById('question-detail') ||
    document.getElementById('question-modal')

  if (!isQuestionPage) {
    console.info(
      'Page sans gestion de questions - QuestionManager non initialisé'
    )
    return
  }

  try {
    questionManagerInstance = new QuestionManager()

    window.questionManager = questionManagerInstance
    console.log('QuestionManager initialisé avec succès')

    window.see_details = id =>
      questionManagerInstance.openQuestionModal(id, 'view')
    window.edit_question = id =>
      questionManagerInstance.openQuestionModal(id, 'edit')
    window.add_to_quizz = id => questionManagerInstance.addQuestionToQuiz(id)
  } catch (error) {
    console.error("Erreur lors de l'initialisation du QuestionManager:", error)
  }
}

document.addEventListener('DOMContentLoaded', initializeQuestionManager)

export { QuestionManager }
export default QuestionManager
