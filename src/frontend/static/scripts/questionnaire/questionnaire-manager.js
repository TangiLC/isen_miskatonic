// questionnaire-manager.js - Manager principal refactorisé
import { Utils } from '../utils/utils.js'
import { ApiService as QRApiService } from '../utils/api-service.js'
import { SelectManager } from '../utils/select-manager.js'
import { QuestionnaireFormValidator } from '../utils/form-validator.js'
import { QuestionnaireModalManager } from './questionnaire-modale-manager.js'

export class QuestionnaireManager {
  constructor () {
    this.config = window.APP_CONFIG || {}
    this.elements = this.getElements()
    this.currentQuestionnaireId = null
    this.userNameCache = new Map()

    // Initialisation des services
    this.apiService = new QRApiService(this.config)

    // Initialisation du validateur
    this.validator = new QuestionnaireFormValidator(this.elements)

    // Initialisation du gestionnaire de modale
    this.modalManager = new QuestionnaireModalManager(
      this.elements,
      null,
      this.validator
    )

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

  showMessage (msg = '', type = 'info') {
    const feedback = this.elements.resultMessage
    if (!feedback) return

    feedback.textContent = msg
    feedback.dataset.type = type
    feedback.classList.remove('success', 'error', 'info')
    feedback.classList.add(type)
  }

  // ===== GESTION DU TABLEAU =====

  async handleLoadClick () {
    const btn = this.elements.loadButton
    const msg = this.elements.resultMessage

    try {
      if (btn) {
        btn.disabled = true
        btn.textContent = 'Chargement…'
      }
      if (msg) msg.textContent = ''

      const data = await this.apiService.fetchQuestionnaires()
      const list = Array.isArray(data) ? data : data?.data ?? []

      this.renderQuestionnaireList(list)

      if (this.elements.scrollCard) this.elements.scrollCard.style.display = ''
      if (msg) {
        const count = this.elements.tableBody?.rows?.length ?? 0
        msg.textContent = `${count} questionnaire(s) chargé(s).`
        msg.dataset.type = 'success'
        msg.classList.add('success')
      }
    } catch (err) {
      console.error(err)
      if (msg) {
        msg.textContent = 'Erreur lors du chargement des questionnaires.'
        msg.dataset.type = 'error'
        msg.classList.add('error')
      }
    } finally {
      if (btn) {
        btn.disabled = false
        btn.textContent = 'Recharger les questionnaires'
      }
    }
  }

  createActionButton ({ src, title, onClick, disabled = false }) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'action-icon-btn'
    btn.title = title
    btn.disabled = disabled

    const img = new Image()
    img.src = src
    img.alt = title

    btn.appendChild(img)
    if (onClick && !disabled) {
      btn.addEventListener('click', onClick)
    }

    return btn
  }

  getActionsForQuestionnaire (questionnaire) {
    const actions = []

    // Action "Voir"
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-eye.svg',
        title: 'Voir les détails du questionnaire',
        onClick: () => this.openQuestionnaireModal('view', questionnaire.id)
      })
    )

    // Action "Éditer" - désactivée si pas le créateur
    const canEdit =
      String(questionnaire.created_by) === String(this.config.userId)
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-edit.svg',
        title: 'Éditer le questionnaire',
        onClick: () => this.openQuestionnaireModal('edit', questionnaire.id),
        disabled: !canEdit
      })
    )

    // Action "Sélectionner" - désactivée si archivé
    const canSelect = String(questionnaire.status) !== 'archive'
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-select.svg',
        title: 'Sélectionner ce questionnaire',
        onClick: () => this.handleSelectQuestionnaire(questionnaire.id),
        disabled: !canSelect
      })
    )

    return actions
  }

  formatDateTime (iso) {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      })
    } catch {
      return iso
    }
  }

  getLatestDate (q) {
    const dates = [q.created_at, q.updated_at, q.edited_at].filter(Boolean)
    if (dates.length === 0) return null

    const validDates = dates.map(d => new Date(d)).filter(d => !isNaN(d))
    if (validDates.length === 0) return null

    return new Date(Math.max(...validDates))
  }

  async renderQuestionnaireList (list) {
    const tbody = this.elements.tableBody
    if (!tbody) return
    tbody.innerHTML = ''

    const toText = v => (Array.isArray(v) ? v.join(', ') : v ?? '')

    for (const q of list) {
      const latestDate = this.getLatestDate(q)
      const tr = document.createElement('tr')

      tr.innerHTML = `
        <td>${q.id ?? ''}</td>
        <td>${q.title ?? q.titre ?? ''}</td>
        <td>${toText(q.subjects ?? q.sujets)}</td>
        <td>${toText(q.uses ?? q.usages)}</td>
        <td>${
          Array.isArray(q.questions)
            ? q.questions.length
            : q.count ?? q.nb_lignes ?? ''
        }</td>
        <td>${
          q.created_by ? await this.getUserNameFromCache(q.created_by) : '-'
        }</td>
        <td>${latestDate ? this.formatDateTime(latestDate) : ''}</td>
      `

      const actionsCell = document.createElement('td')
      actionsCell.className = 'actions-cell'

      const actions = this.getActionsForQuestionnaire(q)
      actions.forEach(btn => actionsCell.appendChild(btn))

      tr.appendChild(actionsCell)
      tbody.appendChild(tr)
    }
  }

  async getUserNameFromCache (userId) {
    if (this.userNameCache.has(userId)) {
      return this.userNameCache.get(userId)
    }

    try {
      const response = await fetch(`/api/users/${userId}/name`)
      const result = await response.json()
      const userName = result.userName || 'Inconnu'
      this.userNameCache.set(userId, userName)
      return userName
    } catch (error) {
      console.warn('Erreur récupération nom utilisateur:', error)
      this.userNameCache.set(userId, 'Inconnu')
      return 'Inconnu'
    }
  }

  async handleSelectQuestionnaire (id) {
    try {
      const data = await this.apiService.selectQuestionnaire(id)

      if (data.success) {
        const q_id = data.questionnaire_id.slice(-6)
        this.showMessage(
          `Questionnaire ..${q_id} sélectionné avec succès`,
          'success'
        )
        setTimeout(() => {
          window.location.href = '/questions'
        }, 1500)
      }
    } catch (error) {
      console.error('Erreur sélection:', error)
      this.showMessage('Impossible de sélectionner ce questionnaire', 'error')
    }
  }

  // ===== GESTION DE LA MODALE =====

  async openQuestionnaireModal (mode, id = null) {
    if (mode === 'create') {
      this.modalManager.openModal('create')
    } else if ((mode === 'view' || mode === 'edit') && id) {
      try {
        this.showMessage('')
        const data = await this.apiService.fetchQuestionnaireById(id)
        this.currentQuestionnaireId = id
        this.modalManager.currentQuestionnaireId = id
        this.modalManager.populateModal(data, mode)

        // En mode edit, configurer la soumission
        if (mode === 'edit') {
          this.setupEditSubmission(data)
        }
      } catch (error) {
        console.error('Erreur récupération questionnaire:', error)
        this.showMessage(`Erreur chargement: ${error.message}`, 'error')
      }
    } else {
      console.error('Mode ou ID invalide', { mode, id })
    }
  }

  setupEditSubmission (originalData) {
    const submitBtn = this.elements.submitBtn
    if (!submitBtn) return

    // Nettoie les anciens handlers
    const newBtn = submitBtn.cloneNode(true)
    submitBtn.parentNode.replaceChild(newBtn, submitBtn)
    this.elements.submitBtn = newBtn

    newBtn.addEventListener('click', async e => {
      e.preventDefault()
      await this.handleSubmit()
    })

    // Bouton reset
    const resetBtn = this.elements.resetBtn
    if (resetBtn) {
      const newReset = resetBtn.cloneNode(true)
      resetBtn.parentNode.replaceChild(newReset, resetBtn)
      this.elements.resetBtn = newReset

      newReset.addEventListener('click', () => {
        this.modalManager.populateModal(originalData, 'edit')
      })
    }
  }

  async handleSubmit () {
    const mode = this.modalManager.currentMode
    const payload = this.modalManager.collectFormData()

    // Validation
    const errors = this.validator.validateSubmissionPayload(payload)
    if (errors.length > 0) {
      this.showMessage(errors[0], 'error')
      return
    }

    try {
      if (mode === 'create') {
        await this.apiService.createQuestionnaire(payload)
        this.showMessage('Questionnaire créé avec succès', 'success')
      } else if (mode === 'edit') {
        const id = this.currentQuestionnaireId
        await this.apiService.updateQuestionnaire(id, payload)
        this.showMessage('Questionnaire modifié avec succès', 'success')
      }

      this.modalManager.closeModal()

      // Recharger la liste
      await this.handleLoadClick()
    } catch (error) {
      console.error('Erreur lors de la soumission:', error)
      this.showMessage(`Erreur: ${error.message}`, 'error')
    }
  }

  // ===== INITIALISATION =====

  async loadSelectData () {
    try {
      const { subjects, uses } = await this.apiService.loadSelectData()

      SelectManager.fillSelectOptions(this.elements.subjectSelect, subjects)
      SelectManager.fillSelectOptions(this.elements.useSelect, uses)

      console.log('Données chargées:', { subjects, uses })
    } catch (error) {
      console.warn('Erreur chargement données select:', error)
    }
  }

  setupEventListeners () {
    // Bouton création
    if (this.elements.createButton) {
      this.elements.createButton.addEventListener('click', () => {
        this.openQuestionnaireModal('create')
      })
    }

    // Bouton chargement
    if (this.elements.loadButton) {
      this.elements.loadButton.addEventListener('click', () =>
        this.handleLoadClick()
      )
    }

    // Boutons modale
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener('click', () => {
        this.modalManager.closeModal()
      })
    }

    if (this.elements.resetBtn) {
      this.elements.resetBtn.addEventListener('click', () => {
        this.modalManager.resetForm()
      })
    }

    // Échap pour fermer
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.elements.modal?.style.display !== 'none') {
        this.modalManager.closeModal()
      }
    })

    // Bouton submit (mode create)
    if (this.elements.submitBtn) {
      this.elements.submitBtn.addEventListener('click', async e => {
        e.preventDefault()
        if (this.modalManager.currentMode === 'create') {
          await this.handleSubmit()
        }
      })
    }

    // Ajout de subject
    if (this.elements.subjectAddBtn) {
      this.elements.subjectAddBtn.addEventListener('click', () => {
        SelectManager.addOptionIfMissing(
          this.elements.subjectSelect,
          this.elements.subjectAdd?.value
        )
        if (this.elements.subjectAdd) this.elements.subjectAdd.value = ''
        this.validator.validateForm()
      })
    }

    // Ajout de use
    if (this.elements.useAddBtn) {
      this.elements.useAddBtn.addEventListener('click', () => {
        SelectManager.addOptionIfMissing(
          this.elements.useSelect,
          this.elements.useAdd?.value
        )
        if (this.elements.useAdd) this.elements.useAdd.value = ''
        this.validator.validateForm()
      })
    }

    // Validation en temps réel
    const inputsToValidate = [
      this.elements.titleInput,
      this.elements.remarkInput
    ]

    inputsToValidate.forEach(input => {
      if (input) {
        input.addEventListener('input', () => this.validator.validateForm())
      }
    })

    const selectsToValidate = [
      this.elements.subjectSelect,
      this.elements.useSelect,
      this.elements.statusSelect
    ]

    selectsToValidate.forEach(select => {
      if (select) {
        select.addEventListener('change', () => {
          this.validator.validateForm()
          this.validator.updateStatusOptions()
        })
      }
    })

    // Événements personnalisés (pour compatibilité future)
    window.addEventListener('questionnaire:open-modal', async e => {
      const { id, questionnaire, mode } = e.detail
      const qid = id ?? questionnaire?.id
      if (!qid) return
      await this.openQuestionnaireModal(mode, qid)
    })

    window.addEventListener('questionnaire:create', () => {
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
