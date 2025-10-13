import { ApiService as QApiService } from '../utils/api-service.js'
import { SelectManager } from '../utils/select-manager.js'
import { ResponseManager } from '../utils/response-manager.js'
import { QuestionFormValidator } from '../utils/form-validator.js'
import { QuestionModalManager } from './question-modale-manager.js'
import {
  BaseManager,
  ActionButtonBuilder,
  ModalHelper,
  ValidationHelper,
  EventBus,
  PermissionChecker
} from '../utils/managers-utils.js'

export class QuestionManager extends BaseManager {
  constructor () {
    super()
    this.elements = this.getElements()
    this.currentQuestionId = null

    // Initialisation des services
    this.apiService = new QApiService(this.config)

    // Initialisation des managers avec callbacks
    this.responseManager = new ResponseManager(
      this.elements.responsesList,
      () => this.validator.validateForm(),
      () => this.validator.updateStatusOptions()
    )

    this.validator = new QuestionFormValidator(
      this.elements,
      this.responseManager
    )

    this.modalManager = new QuestionModalManager(
      this.elements,
      this.responseManager,
      this.validator
    )

    this.init()
  }

  getElements () {
    return {
      createButton: document.getElementById('createQ'),
      modal: document.getElementById('question-modal'),
      closeBtn: document.getElementById('q-close-btn'),
      form: document.getElementById('question-form'),
      submitBtn: document.getElementById('submit-btn'),
      resetBtn: document.getElementById('reset-btn'),

      // Titre et infos
      modalTitle: document.querySelector('#question-modal .question-title h2'),
      infoSections: document.querySelectorAll('#question-modal .q-info > div'),

      // Inputs
      questionInput: document.getElementById('q-question-input'),
      subjectSelect: document.getElementById('q-subject-select'),
      useSelect: document.getElementById('q-use-select'),
      remarkInput: document.getElementById('q-remark-input'),
      statusSelect: document.getElementById('q-status-select'),

      // Subject/Use management
      subjectAdd: document.getElementById('q-subject-add'),
      subjectAddBtn: document.getElementById('q-subject-add-btn'),
      useAdd: document.getElementById('q-use-add'),
      useAddBtn: document.getElementById('q-use-add-btn'),

      // Responses
      responsesList: document.getElementById('responses-list'),
      addResponseBtn: document.getElementById('add-response-btn'),

      // Feedback
      feedback: document.getElementById('feedback'),
      resultMessage: document.getElementById('resultMessage'),
      debugOutput: document.getElementById('debug-output')
    }
  }

  getFeedbackElement () {
    return this.elements.feedback || this.elements.resultMessage
  }

  // ===== ACTIONS PUBLIQUES =====

  async openQuestionModal (id, mode) {
    try {
      this.showMessage('', 'info', this.getFeedbackElement())
      this.currentQuestionId = id
      const data = await this.apiService.fetchQuestion(id)
      this.modalManager.populateModal(data, mode)

      if (mode === 'edit') {
        this.setupEditSubmission(data)
      }
    } catch (error) {
      this.showMessage(
        `Erreur chargement: ${error.message}`,
        'error',
        this.getFeedbackElement()
      )
    }
  }

  setupEditSubmission (originalData) {
    const { newSubmit, newReset } = ModalHelper.setupEditSubmission(
      this.elements.submitBtn,
      this.elements.resetBtn,
      async () => await this.handleEditSubmit(),
      () => this.modalManager.populateModal(originalData, 'edit')
    )

    if (newSubmit) this.elements.submitBtn = newSubmit
    if (newReset) this.elements.resetBtn = newReset
  }

  async handleEditSubmit () {
    try {
      const payload = this.modalManager.collectFormData()

      if (!payload.question) {
        this.showMessage(
          "L'intitulé est requis.",
          'error',
          this.getFeedbackElement()
        )
        return
      }

      await this.apiService.updateQuestion(this.currentQuestionId, payload)
      this.modalManager.closeModal()

      const shortId = this.formatId(this.currentQuestionId)
      this.showMessage(
        `Question ..${shortId} modifiée avec succès.`,
        'success',
        this.getFeedbackElement()
      )

      EventBus.questions.updated(payload)

      // Rafraîchir le tableau si disponible
      if (window.tableManager?.refreshTable) {
        window.tableManager.refreshTable()
      }
    } catch (error) {
      this.modalManager.closeModal()
      this.showMessage(
        `Erreur modification: ${error.message}`,
        'error',
        this.getFeedbackElement()
      )
    }
  }

  async addQuestionToQuiz (id) {
    try {
      const data = await this.apiService.fetchQuestion(id)

      EventBus.questions.addToQuiz(data)

      const shortId = this.formatId(id)
      this.showMessage(
        `Question ..${shortId} ajoutée au quizz.`,
        'success',
        this.getFeedbackElement()
      )
    } catch (error) {
      this.showMessage(
        `Erreur ajout au quizz: ${error.message}`,
        'error',
        this.getFeedbackElement()
      )
    }
  }

  buildQuestionPayload () {
    const { responses, corrects } = this.responseManager.getResponsesData()

    return {
      id: null,
      question: this.elements.questionInput?.value.trim() || '',
      subject: SelectManager.collectMultiSelect(this.elements.subjectSelect),
      use: SelectManager.collectMultiSelect(this.elements.useSelect),
      responses,
      corrects,
      remark: this.elements.remarkInput?.value.trim() || null,
      status: this.elements.statusSelect?.value || 'draft',
      created_by: this.config.user?.id || null,
      created_at: new Date().toISOString(),
      edited_at: null
    }
  }

  async loadSelectData () {
    try {
      const { subjects, uses } = await this.apiService.loadSelectData()

      SelectManager.fillSelectOptions(this.elements.subjectSelect, subjects)
      SelectManager.fillSelectOptions(this.elements.useSelect, uses)
    } catch (error) {
      console.warn('Erreur chargement données select:', error)
    }
  }

  async submitForm (evt) {
    evt.preventDefault()

    const payload = this.buildQuestionPayload()
    const currentStatus = payload.status || 'draft'

    // Validation côté client
    const validationErrors = this.validator.validateSubmissionPayload(payload)
    if (validationErrors.length > 0) {
      this.showMessage(validationErrors[0], 'error', this.getFeedbackElement())
      return
    }

    if (!this.config.apiUrl) {
      this.showMessage(
        'Configuration API manquante.',
        'error',
        this.getFeedbackElement()
      )
      return
    }

    try {
      this.showMessage('Envoi en cours…', 'info', this.getFeedbackElement())

      const response = await this.apiService.createQuestion(payload)

      const isJson = (response.headers.get('content-type') || '').includes(
        'application/json'
      )
      const body = isJson ? await response.json() : await response.text()

      if (response.status === 201) {
        const statusTexts = {
          draft: ' en brouillon',
          active: ' et activée',
          archive: ' et archivée'
        }
        const statusText = statusTexts[currentStatus] || ''

        this.showMessage(
          `Question créée avec succès${statusText}.`,
          'success',
          this.getFeedbackElement()
        )

        if (body?.id && this.elements.feedback) {
          const link = document.createElement('a')
          link.href = `${this.config.apiUrl}/question/${encodeURIComponent(
            body.id
          )}`
          link.textContent = 'Voir la ressource'
          link.target = '_blank'
          this.elements.feedback.appendChild(document.createTextNode(' '))
          this.elements.feedback.appendChild(link)
        }

        EventBus.questions.created(body)

        this.modalManager.resetForm()

        // Rafraîchir le tableau si disponible
        if (window.tableManager?.refreshTable) {
          window.tableManager.refreshTable()
        }

        setTimeout(() => this.modalManager.closeModal(), 2000)
        return
      }

      // Gestion des erreurs
      const errorMessages = {
        401: 'Authentification requise ou token invalide/expiré.',
        409: 'Conflit lors de la création (doublon possible).',
        422: body?.detail
          ? JSON.stringify(body.detail)
          : 'Erreur de validation.'
      }

      const errorMsg =
        errorMessages[response.status] ||
        (typeof body === 'string' ? body : body?.message || 'Erreur serveur.')

      this.showMessage(errorMsg, 'error', this.getFeedbackElement())
    } catch (err) {
      console.error('Erreur lors de la soumission:', err)
      this.showMessage(
        "Impossible d'atteindre le serveur.",
        'error',
        this.getFeedbackElement()
      )
    }

    // Debug
    this.modalManager.showDebug(payload)
  }

  setupEventListeners () {
    // Modal
    this.elements.createButton?.addEventListener('click', () =>
      this.modalManager.openModal('create')
    )

    this.elements.closeBtn?.addEventListener('click', () =>
      this.modalManager.closeModal()
    )

    ModalHelper.setupBackdropClose(this.elements.modal, () =>
      this.modalManager.closeModal()
    )

    ModalHelper.setupEscapeClose(this.elements.modal, () =>
      this.modalManager.closeModal()
    )

    // Ajout d'options
    this.elements.subjectAddBtn?.addEventListener('click', () => {
      SelectManager.addOptionIfMissing(
        this.elements.subjectSelect,
        this.elements.subjectAdd?.value
      )
      if (this.elements.subjectAdd) this.elements.subjectAdd.value = ''
      this.validator.validateForm()
    })

    this.elements.useAddBtn?.addEventListener('click', () => {
      SelectManager.addOptionIfMissing(
        this.elements.useSelect,
        this.elements.useAdd?.value
      )
      if (this.elements.useAdd) this.elements.useAdd.value = ''
      this.validator.validateForm()
    })

    // Ajout de réponse
    this.elements.addResponseBtn?.addEventListener('click', () =>
      this.responseManager.addResponseRow()
    )

    // Soumission
    this.elements.submitBtn?.addEventListener('click', e => this.submitForm(e))
    this.elements.form?.addEventListener('submit', e => this.submitForm(e))

    // Réinitialisation
    this.elements.resetBtn?.addEventListener('click', () =>
      this.modalManager.resetForm()
    )

    // Validation en temps réel
    ValidationHelper.attachRealTimeValidation(
      {
        inputs: [this.elements.questionInput, this.elements.remarkInput],
        selects: [
          this.elements.subjectSelect,
          this.elements.useSelect,
          this.elements.statusSelect
        ]
      },
      this.validator
    )

    // Observer pour les changements dans la liste des réponses
    ValidationHelper.setupMutationObserver(this.elements.responsesList, () => {
      this.validator.validateForm()
      this.validator.updateStatusOptions()
    })

    // Délégation d'événements pour les actions du tableau
    document.addEventListener('click', ev => {
      const btn = ev.target.closest('button[data-action]')
      if (!btn) return

      const id = btn.getAttribute('data-id')
      const action = btn.getAttribute('data-action')
      if (!id || !action) return

      const actionMap = {
        see_details: () => this.openQuestionModal(id, 'view'),
        edit_question: () => this.openQuestionModal(id, 'edit'),
        add_to_quizz: () => this.addQuestionToQuiz(id)
      }

      actionMap[action]?.()
    })
  }

  async init () {
    await this.loadSelectData()

    // Initialiser avec 2 réponses par défaut
    if (
      this.elements.responsesList &&
      this.elements.responsesList.children.length === 0
    ) {
      this.responseManager.addResponseRow()
      this.responseManager.addResponseRow()
    }

    this.setupEventListeners()
    this.validator.validateForm()
    this.validator.updateStatusOptions()
  }
}
