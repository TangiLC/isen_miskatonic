// questionnaire-manager.js - Manager principal refactorisé
import { Utils } from '../utils/utils.js'
import { QuestionnaireApiService as QApiService } from './questionnaire-api-service.js'
import { SelectManager } from '../utils/select-manager.js'
import { ResponseManager } from '../utils/response-manager.js'
import { QuestionnaireFormValidator } from './form-validator.js'
import { QuestionnaireModalManager } from './questionnaire-modale-manager.js'

export class QuestionnaireManager {
  constructor () {
    this.config = window.APP_CONFIG || {}
    this.elements = this.getElements()
    this.currentQuestionnaireId = null

    // Initialisation des services
    this.apiService = new QApiService(this.config)

    // Initialisation des managers avec callbacks
    this.responseManager = new ResponseManager(
      this.elements.responsesList,
      () => this.validator.validateForm(),
      () => this.validator.updateStatusOptions()
    )

    this.validator = new QuestionnaireFormValidator(
      this.elements,
      this.responseManager
    )
    this.modalManager = new QuestionnaireModalManager(
      this.elements,
      this.responseManager,
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
      form: document.getElementById('questionnaire-form'),
      submitBtn: document.getElementById('submit-btn'),
      resetBtn: document.getElementById('reset-btn'),

      // Titre et infos
      modalTitle: document.querySelector(
        '#questionnaire-modal .questionnaire-title h2'
      ),
      infoSections: document.querySelectorAll(
        '#questionnaire-modal .qr-info > div'
      ),

      // Inputs
      titleInput: document.getElementById('qr-title-input'),
      subjectSelect: document.getElementById('qr-subject-select'),
      useSelect: document.getElementById('qr-use-select'),
      remarkInput: document.getElementById('qr-remark-input'),
      statusSelect: document.getElementById('qr-status-select'),
      addResponseBtn: document.getElementById('qr-add-response-btn'),
      responsesList: document.getElementById('qr-responses-list'),
      debugOutput: document.getElementById('qr-debug-output'),
      resultMessage: document.getElementById('resultMessage'),
      scrollCard: document.getElementById('scroll-card'),
      tableBody: document.querySelector('#questionnairesTable tbody')
    }
  }

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
      }
    } catch (err) {
      console.error(err)
      if (msg) msg.textContent = 'Erreur lors du chargement des questionnaires.'
    } finally {
      if (btn) {
        btn.disabled = false
        btn.textContent = 'Recharger les questionnaires'
      }
    }
  }

  // Création d'un bouton d'action avec icône SVG
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

  // Gestion des actions pour un questionnaire
  getActionsForQuestionnaire (questionnaire) {
    const actions = []

    // Action "Voir"
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-eye.svg',
        title: 'Voir les détails du questionnaire',
        onClick: () => this.handleViewDetails(questionnaire.id)
      })
    )

    // Action "Éditer" - désactivée si pas le créateur
    const canEdit =
      String(questionnaire.created_by) === String(this.config.userId)
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-edit.svg',
        title: 'Éditer le questionnaire',
        onClick: () => this.handleEditQuestionnaire(questionnaire.id),
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

  renderQuestionnaireList (list) {
    const tbody = this.elements.tableBody
    if (!tbody) return
    tbody.innerHTML = ''

    const toText = v => (Array.isArray(v) ? v.join(', ') : v ?? '')

    // Fonction pour obtenir la date la plus récente
    const getLatestDate = q => {
      const dates = [q.created_at, q.updated_at, q.edited_at].filter(Boolean)
      if (dates.length === 0) return null

      const validDates = dates.map(d => new Date(d)).filter(d => !isNaN(d))

      if (validDates.length === 0) return null
      return new Date(Math.max(...validDates))
    }

    for (const q of list) {
      const latestDate = getLatestDate(q)
      const tr = document.createElement('tr')

      // Colonnes de données
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
        <td>${q.created_by ?? q.author ?? ''}</td>
        <td>${latestDate ? this.formatDateTime(latestDate) : ''}</td>
      `

      // Colonne Actions
      const actionsCell = document.createElement('td')
      actionsCell.className = 'actions-cell'

      const actions = this.getActionsForQuestionnaire(q)
      actions.forEach(btn => actionsCell.appendChild(btn))

      tr.appendChild(actionsCell)
      tbody.appendChild(tr)
    }
  }

  // Handlers pour les actions
  handleViewDetails (id) {
    this.openQuestionnaireModal(id, 'view')
  }

  handleEditQuestionnaire (id) {
    this.openQuestionnaireModal(id, 'edit')
  }

  handleSelectQuestionnaire (id) {
    console.log('Sélectionner le questionnaire:', id)
    // Ajouter votre logique de sélection ici
    // Par exemple : rediriger vers une page, ouvrir une modale, etc.
  }

  setupEventListeners () {
    // Bouton de création de questionnaire
    if (this.elements.createButton) {
      this.elements.createButton.addEventListener('click', () => {
        this.openQuestionnaireModal(null, 'create')
      })
    }

    // Bouton de chargement des questionnaires
    if (this.elements.loadButton) {
      this.elements.loadButton.addEventListener('click', () =>
        this.handleLoadClick()
      )
    }

    // Boutons de la modale
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

    // Validation en temps réel
    ;[this.elements.titleInput, this.elements.remarkInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => this.validator.validateForm())
      }
    })
    ;[
      this.elements.subjectSelect,
      this.elements.useSelect,
      this.elements.statusSelect
    ].forEach(select => {
      if (select) {
        select.addEventListener('change', () => this.validator.validateForm())
      }
    })

    // Observer pour les changements dans la liste des réponses
    if (this.elements.responsesList && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        this.validator.validateForm()
        this.validator.updateStatusOptions()
      })
      observer.observe(this.elements.responsesList, {
        childList: true,
        subtree: true
      })
    }
  }

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

  async init () {
    await this.loadSelectData()

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

  // Affichage simple d'un message dans #resultMessage
  showMessage (text = '', type = 'info') {
    const el = this.elements?.resultMessage
    if (!el) return
    el.textContent = String(text || '')
    el.dataset.type = type
  }

  // Rendu générique de la liste dans le tableau central
  renderTable (list = []) {
    this.renderQuestionnaireList(Array.isArray(list) ? list : [])
    if (this.elements?.scrollCard) this.elements.scrollCard.style.display = ''
  }

  // Nouvelle API publique demandée
  async loadQuestionnaires () {
    try {
      this.showMessage('Chargement…', 'info')
      const data = await this.apiService.fetchQuestionnaires()
      const list = Array.isArray(data) ? data : data?.data ?? []
      this.renderTable(list)
      const count = this.elements.tableBody?.rows?.length ?? list.length ?? 0
      this.showMessage(`${count} questionnaire(s) chargé(s).`, 'success')
    } catch (err) {
      console.error(err)
      this.renderTable([])
      this.showMessage('Erreur lors du chargement des questionnaires.', 'error')
    }
  }

  // Méthode pour ouvrir la modale
  openQuestionnaireModal (id, mode) {
    if (
      this.modalManager &&
      typeof this.modalManager.openModal === 'function'
    ) {
      this.modalManager.openModal(id, mode)
    } else {
      console.warn('modalManager.openModal not available')
    }
  }
}
