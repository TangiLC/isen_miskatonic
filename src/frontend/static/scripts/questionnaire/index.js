// questionnaire/index.js - Point d'entrée principal pour la gestion des questionnaires
import { QuestionnaireManager } from './questionnaire-manager.js'
import { QuestionnaireModalManager } from './questionnaire-modale-manager.js'
import { QuestionnaireValidator } from './questionnaire-validator.js'
import { QuestionnaireApiService } from './questionnaire-api-service.js'
import { SelectManager } from '../utils/select-manager.js'

let questionnaireManagerInstance = null
let modalManagerInstance = null
let validatorInstance = null
let apiServiceInstance = null

function initializeQuestionnaireManagers () {
  // Vérifier qu'on est sur la bonne page
  const isQuestionnairePage = document.getElementById('questionnairesTable')

  if (!isQuestionnairePage) {
    console.info(
      'Page sans gestion de questionnaires - Managers non initialisés'
    )
    return
  }

  try {
    const config = window.APP_CONFIG || {}

    // Initialiser le service API
    apiServiceInstance = new QuestionnaireApiService(config)

    // Récupérer les éléments de la modale
    const modalElements = getModalElements()

    // Initialiser le validateur
    validatorInstance = new QuestionnaireValidator(modalElements)

    // Initialiser le gestionnaire de modale
    modalManagerInstance = new QuestionnaireModalManager(
      modalElements,
      validatorInstance
    )

    // Initialiser le gestionnaire principal (tableau)
    questionnaireManagerInstance = new QuestionnaireManager()

    // Charger les données pour les selects (subjects/uses)
    loadSelectData()

    // Configurer les événements de la modale
    setupModalEvents()

    // Exposer globalement
    window.questionnaireManager = questionnaireManagerInstance
    window.questionnaireModalManager = modalManagerInstance

    console.log('Questionnaire Managers initialisés avec succès')
  } catch (error) {
    console.error(
      "Erreur lors de l'initialisation des Questionnaire Managers:",
      error
    )
  }
}

function getModalElements () {
  return {
    modal: document.getElementById('questionnaire-modal'),
    closeBtn: document.getElementById('qr-close-btn'),
    submitBtn: document.getElementById('qr-submit-btn'),
    resetBtn: document.getElementById('qr-reset-btn'),

    // Titre et infos
    modalTitle: document.querySelector(
      '#questionnaire-modal .question-title h2'
    ),
    infoSections: document.querySelectorAll(
      '#questionnaire-modal .q-info > div'
    ),

    // Inputs
    titleInput: document.getElementById('qr-title-input'),
    subjectSelect: document.getElementById('qr-subject-select'),
    useSelect: document.getElementById('qr-use-select'),
    remarkInput: document.getElementById('qr-remark-input'),
    statusSelect: document.getElementById('qr-status-select'),

    // Boutons d'ajout
    subjectAdd: document.getElementById('qr-subject-add'),
    subjectAddBtn: document.getElementById('qr-subject-add-btn'),
    useAdd: document.getElementById('qr-use-add'),
    useAddBtn: document.getElementById('qr-use-add-btn'),

    // Feedback
    feedback: document.getElementById('resultMessage')
  }
}

async function loadSelectData () {
  try {
    const { subjects, uses } = await apiServiceInstance.loadSelectData()

    const modalElements = getModalElements()
    SelectManager.fillSelectOptions(modalElements.subjectSelect, subjects)
    SelectManager.fillSelectOptions(modalElements.useSelect, uses)

    console.log('Données select chargées:', {
      subjects: subjects.length,
      uses: uses.length
    })
  } catch (error) {
    console.warn('Erreur chargement données select:', error)
  }
}

function setupModalEvents () {
  const modalElements = getModalElements()

  // Bouton fermer
  if (modalElements.closeBtn) {
    modalElements.closeBtn.addEventListener('click', () => {
      modalManagerInstance.closeModal()
    })
  }

  // Clic en dehors de la modale
  if (modalElements.modal) {
    modalElements.modal.addEventListener('click', e => {
      if (e.target === modalElements.modal) {
        modalManagerInstance.closeModal()
      }
    })
  }

  // Échap pour fermer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalElements.modal?.style.display !== 'none') {
      modalManagerInstance.closeModal()
    }
  })

  // Bouton submit
  if (modalElements.submitBtn) {
    modalElements.submitBtn.addEventListener('click', async e => {
      e.preventDefault()
      await handleSubmit()
    })
  }

  // Bouton reset
  if (modalElements.resetBtn) {
    modalElements.resetBtn.addEventListener('click', () => {
      modalManagerInstance.resetForm()
    })
  }

  // Ajout de subject
  if (modalElements.subjectAddBtn) {
    modalElements.subjectAddBtn.addEventListener('click', () => {
      SelectManager.addOptionIfMissing(
        modalElements.subjectSelect,
        modalElements.subjectAdd?.value
      )
      if (modalElements.subjectAdd) modalElements.subjectAdd.value = ''
      validatorInstance.validateForm()
    })
  }

  // Ajout de use
  if (modalElements.useAddBtn) {
    modalElements.useAddBtn.addEventListener('click', () => {
      SelectManager.addOptionIfMissing(
        modalElements.useSelect,
        modalElements.useAdd?.value
      )
      if (modalElements.useAdd) modalElements.useAdd.value = ''
      validatorInstance.validateForm()
    })
  }

  // Validation en temps réel
  const inputsToValidate = [modalElements.titleInput, modalElements.remarkInput]

  inputsToValidate.forEach(input => {
    if (input) {
      input.addEventListener('input', () => validatorInstance.validateForm())
    }
  })

  const selectsToValidate = [
    modalElements.subjectSelect,
    modalElements.useSelect,
    modalElements.statusSelect
  ]

  selectsToValidate.forEach(select => {
    if (select) {
      select.addEventListener('change', () => {
        validatorInstance.validateForm()
        validatorInstance.updateStatusOptions()
      })
    }
  })
  window.addEventListener('questionnaire:open-modal', async e => {
    const { id, questionnaire, mode } = e.detail
    const qid = id ?? questionnaire?.id
    if (!qid) return
    await openQuestionnaireModal(qid, mode)
  })

  window.addEventListener('questionnaire:create', () => {
    modalManagerInstance.openModal('create')
  })
}

async function handleSubmit () {
  const mode = modalManagerInstance.currentMode
  const payload = modalManagerInstance.collectFormData()

  // Validation
  const errors = validatorInstance.validateSubmissionPayload(payload)
  if (errors.length > 0) {
    showMessage(errors[0], 'error')
    return
  }

  try {
    if (mode === 'create') {
      await questionnaireManagerInstance.createQuestionnaire(payload)
    } else if (mode === 'edit') {
      const id = modalManagerInstance.currentQuestionnaireId
      await questionnaireManagerInstance.updateQuestionnaire(id, payload)
    }

    modalManagerInstance.closeModal()
  } catch (error) {
    console.error('Erreur lors de la soumission:', error)
    showMessage(`Erreur: ${error.message}`, 'error')
  }
}

async function openQuestionnaireModal (id, mode) {
  try {
    showMessage('')
    const data = await apiServiceInstance.fetchQuestionnaire(id)
    modalManagerInstance.currentQuestionnaireId = id
    modalManagerInstance.populateModal(data, mode)
  } catch (error) {
    showMessage(`Erreur chargement: ${error.message}`, 'error')
  }
}

function showMessage (msg, type = 'info') {
  const feedback = document.getElementById('resultMessage')
  if (!feedback) return

  feedback.textContent = msg
  feedback.dataset.type = type
  feedback.classList.remove('success', 'error', 'info')
  feedback.classList.add(type)
}

// Fonctions globales pour compatibilité avec les boutons HTML
window.view_questionnaire = id => {
  openQuestionnaireModal(id, 'view')
}

window.edit_questionnaire = id => {
  openQuestionnaireModal(id, 'edit')
}

window.create_questionnaire = () => {
  modalManagerInstance.openModal('create')
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', initializeQuestionnaireManagers)

export {
  QuestionnaireManager,
  QuestionnaireModalManager,
  QuestionnaireValidator,
  QuestionnaireApiService
}
