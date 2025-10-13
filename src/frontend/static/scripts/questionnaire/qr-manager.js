import { ApiService as QRApiService } from '../utils/api-service.js'
import { SelectManager } from '../utils/select-manager.js'
import { QuestionnaireFormValidator } from '../utils/form-validator.js'
import { QuestionnaireModalManager } from './questionnaire-modale-manager.js'
import {
  BaseManager,
  ActionButtonBuilder,
  ModalHelper,
  ValidationHelper,
  LoadingHelper,
  EventBus,
  PermissionChecker,
  TableRenderHelper
} from '../utils/managers-utils.js'

export class QuestionnaireManager extends BaseManager {
  constructor () {
    super()
    this.elements = this.getElements()
    this.currentQuestionnaireId = null

    // Initialisation des services
    this.apiService = new QRApiService(this.config)
    this.validator = new QuestionnaireFormValidator(this.elements)

    // Initialisation du gestionnaire de modale
    this.modalManager = new QuestionnaireModalManager(
      this.elements,
      null,
      this.validator
    )
    this.modalManager.onRandomAdd = async (id, data) => {
      await this.handleRandomAdd(id, data)
    }

    this.init()
  }

  getElements () {
    return {
      createButton: document.getElementById('createQR'),
      loadButton: document.getElementById('loadQR'),
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

      // Random
      randomSection: document.getElementById('qr-random-section'),
      randomNumber: document.getElementById('qr-random-number'),
      randomSubjects: document.getElementById('qr-random-subjects'),
      randomAddBtn: document.getElementById('qr-random-add-btn'),

      // Boutons d'ajout
      subjectAdd: document.getElementById('qr-subject-add'),
      subjectAddBtn: document.getElementById('qr-subject-add-btn'),
      useAdd: document.getElementById('qr-use-add'),
      useAddBtn: document.getElementById('qr-use-add-btn'),

      // Feedback et tableau
      resultMessage: document.getElementById('resultMessage'),
      scrollCard: document.getElementById('scroll-card'),
      tableBody: document.querySelector('#questionnairesTable tbody')
    }
  }

  // ===== GESTION DU TABLEAU =====

  async handleLoadClick () {
    await LoadingHelper.withLoadingButton(
      this.elements.loadButton,
      'Chargement…',
      async () => {
        try {
          const data = await this.apiService.fetchQuestionnaires()
          const list = Array.isArray(data) ? data : data?.data ?? []

          await this.renderQuestionnaireList(list)

          if (this.elements.scrollCard) {
            this.elements.scrollCard.style.display = ''
          }

          this.showMessage(
            `${list.length} questionnaire(s) chargé(s).`,
            'success',
            this.elements.resultMessage
          )
        } catch (err) {
          console.error(err)
          this.showMessage(
            'Erreur lors du chargement des questionnaires.',
            'error',
            this.elements.resultMessage
          )
        }
      }
    )
  }

  getActionsForQuestionnaire (questionnaire) {
    const canEdit = PermissionChecker.canEdit(questionnaire, this.config.userId)
    const canSelect = PermissionChecker.canSelect(questionnaire)

    return [
      ActionButtonBuilder.createViewAction(() =>
        this.openQuestionnaireModal('view', questionnaire.id)
      ),
      ActionButtonBuilder.createEditAction(
        () => this.openQuestionnaireModal('edit', questionnaire.id),
        canEdit
      ),
      ActionButtonBuilder.createSelectAction(
        () => this.handleSelectQuestionnaire(questionnaire.id),
        canSelect
      )
    ]
  }

  async renderQuestionnaireList (list) {
    const tbody = this.elements.tableBody
    if (!tbody) return
    tbody.innerHTML = ''

    for (const q of list) {
      const latestDate = this.getLatestDate(
        q.created_at,
        q.updated_at,
        q.edited_at
      )
      const tr = document.createElement('tr')

      const cells = [
        q.id ?? '',
        q.title ?? q.titre ?? '',
        this.toText(q.subjects ?? q.sujets),
        this.toText(q.uses ?? q.usages),
        Array.isArray(q.questions)
          ? q.questions.length
          : q.count ?? q.nb_lignes ?? '',
        q.created_by ? await this.getUserNameFromCache(q.created_by) : '-',
        latestDate ? this.formatDateTime(latestDate) : ''
      ]

      cells.forEach(content => {
        tr.appendChild(TableRenderHelper.createCell(content))
      })

      const actions = this.getActionsForQuestionnaire(q)
      tr.appendChild(TableRenderHelper.createActionsCell(actions))

      tbody.appendChild(tr)
    }
  }

  async handleSelectQuestionnaire (id) {
    try {
      const data = await this.apiService.selectQuestionnaire(id)

      if (data.success) {
        const q_id = this.formatId(data.questionnaire_id, 6)
        this.showMessage(
          `Questionnaire ..${q_id} sélectionné avec succès`,
          'success',
          this.elements.resultMessage
        )

        EventBus.questionnaires.selected(id)

        setTimeout(() => {
          window.location.href = '/questions'
        }, 1500)
      }
    } catch (error) {
      console.error('Erreur sélection:', error)
      this.showMessage(
        'Impossible de sélectionner ce questionnaire',
        'error',
        this.elements.resultMessage
      )
    }
  }

  async handleRandomAdd (id, data) {
    await LoadingHelper.withFeedback(
      this.elements.resultMessage,
      'Ajout des questions en cours...',
      null,
      null,
      async () => {
        const result = await this.apiService.addRandomQuestions(id, data)

        this.showMessage(
          result.message || 'Questions ajoutées avec succès',
          'success',
          this.elements.resultMessage
        )

        // Mettre à jour la modale avec les nouvelles données
        if (result.response) {
          this.modalManager.modalQuestions = result.response.questions || []
          this.modalManager.renderModalQuestionsTable(
            this.modalManager.currentMode
          )
        }
      }
    ).catch(error => {
      this.showMessage(
        `Erreur: ${error.message}`,
        'error',
        this.elements.resultMessage
      )
    })
  }

  // ===== GESTION DE LA MODALE =====

  async openQuestionnaireModal (mode, id = null) {
    if (mode === 'create') {
      this.modalManager.openModal('create')
    } else if ((mode === 'view' || mode === 'edit') && id) {
      try {
        this.showMessage('', 'info', this.elements.resultMessage)
        const data = await this.apiService.fetchQuestionnaireById(id)
        this.currentQuestionnaireId = id
        this.modalManager.currentQuestionnaireId = id
        this.modalManager.populateModal(data, mode)

        if (mode === 'edit') {
          this.setupEditSubmission(data)
        }
      } catch (error) {
        console.error('Erreur récupération questionnaire:', error)
        this.showMessage(
          `Erreur chargement: ${error.message}`,
          'error',
          this.elements.resultMessage
        )
      }
    } else {
      console.error('Mode ou ID invalide', { mode, id })
    }
  }

  setupEditSubmission (originalData) {
    const { newSubmit, newReset } = ModalHelper.setupEditSubmission(
      this.elements.submitBtn,
      this.elements.resetBtn,
      async () => await this.handleSubmit(),
      () => this.modalManager.populateModal(originalData, 'edit')
    )

    if (newSubmit) this.elements.submitBtn = newSubmit
    if (newReset) this.elements.resetBtn = newReset
  }

  async handleSubmit () {
    const mode = this.modalManager.currentMode
    const payload = this.modalManager.collectFormData()

    // Validation
    const errors = this.validator.validateSubmissionPayload(payload)
    if (errors.length > 0) {
      this.showMessage(errors[0], 'error', this.elements.resultMessage)
      return
    }

    try {
      if (mode === 'create') {
        const result = await this.apiService.createQuestionnaire(payload)
        this.showMessage(
          'Questionnaire créé avec succès',
          'success',
          this.elements.resultMessage
        )
        EventBus.questionnaires.created(result)
      } else if (mode === 'edit') {
        const result = await this.apiService.updateQuestionnaire(
          this.currentQuestionnaireId,
          payload
        )
        this.showMessage(
          'Questionnaire modifié avec succès',
          'success',
          this.elements.resultMessage
        )
        EventBus.questionnaires.updated(result)
      }

      this.modalManager.closeModal()
      await this.handleLoadClick()
    } catch (error) {
      console.error('Erreur lors de la soumission:', error)
      this.showMessage(
        `Erreur: ${error.message}`,
        'error',
        this.elements.resultMessage
      )
    }
  }

  // ===== INITIALISATION =====

  async loadSelectData () {
    try {
      const { subjects, uses } = await this.apiService.loadSelectData()

      SelectManager.fillSelectOptions(this.elements.subjectSelect, subjects)
      SelectManager.fillSelectOptions(this.elements.useSelect, uses)
    } catch (error) {
      console.warn('Erreur chargement données select:', error)
    }
  }

  setupEventListeners () {
    // Bouton création
    this.elements.createButton?.addEventListener('click', () => {
      this.openQuestionnaireModal('create')
    })

    // Bouton chargement
    this.elements.loadButton?.addEventListener('click', () =>
      this.handleLoadClick()
    )

    // Boutons modale
    this.elements.closeBtn?.addEventListener('click', () => {
      this.modalManager.closeModal()
    })

    this.elements.resetBtn?.addEventListener('click', () => {
      this.modalManager.resetForm()
    })

    // Configuration modale
    ModalHelper.setupEscapeClose(this.elements.modal, () =>
      this.modalManager.closeModal()
    )

    // Bouton submit (mode create)
    this.elements.submitBtn?.addEventListener('click', async e => {
      e.preventDefault()
      if (this.modalManager.currentMode === 'create') {
        await this.handleSubmit()
      }
    })

    // Ajout de subject
    this.elements.subjectAddBtn?.addEventListener('click', () => {
      SelectManager.addOptionIfMissing(
        this.elements.subjectSelect,
        this.elements.subjectAdd?.value
      )
      if (this.elements.subjectAdd) this.elements.subjectAdd.value = ''
      this.validator.validateForm()
    })

    // Ajout de use
    this.elements.useAddBtn?.addEventListener('click', () => {
      SelectManager.addOptionIfMissing(
        this.elements.useSelect,
        this.elements.useAdd?.value
      )
      if (this.elements.useAdd) this.elements.useAdd.value = ''
      this.validator.validateForm()
    })

    // Validation en temps réel
    ValidationHelper.attachRealTimeValidation(
      {
        inputs: [this.elements.titleInput, this.elements.remarkInput],
        selects: [
          this.elements.subjectSelect,
          this.elements.useSelect,
          this.elements.statusSelect
        ]
      },
      this.validator
    )

    // Mise à jour des options de status lors du changement
    ;[
      this.elements.subjectSelect,
      this.elements.useSelect,
      this.elements.statusSelect
    ].forEach(select => {
      select?.addEventListener('change', () => {
        this.validator.updateStatusOptions()
      })
    })

    // Événements personnalisés
    EventBus.on('questionnaire:open-modal', async e => {
      const { id, questionnaire, mode } = e.detail
      const qid = id ?? questionnaire?.id
      if (qid) await this.openQuestionnaireModal(mode, qid)
    })

    EventBus.on('questionnaire:create', () => {
      this.modalManager.openModal('create')
    })
  }

  async init () {
    await this.loadSelectData()
    this.setupEventListeners()
    this.validator.validateForm()
    this.validator.updateStatusOptions()

    // Chargement automatique des questionnaires
    await this.handleLoadClick()
  }
}
