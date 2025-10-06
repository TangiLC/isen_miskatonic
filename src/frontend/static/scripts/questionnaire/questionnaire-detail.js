import { QRApiService } from './api-service.js'

class QuestionnaireDetail {
  constructor () {
    this.config = window.APP_CONFIG || {}
    this.apiService = new QRApiService(this.config)
    this.questionnaireId = this.config.questionnaireId
    this.currentQuestionnaire = null
    this.draftQuestions = [] // Brouillon local des questions
    this.hasUnsavedChanges = false

    this.elements = this.getElements()
    this.init()
  }

  getElements () {
    return {
      title: document.querySelector('.questionnaire-title'),
      subjects: document.querySelector(
        '.questionnaire-meta .meta-item:nth-child(1) .meta-value'
      ),
      uses: document.querySelector(
        '.questionnaire-meta .meta-item:nth-child(2) .meta-value'
      ),
      createdAt: document.querySelector(
        '.questionnaire-meta .meta-item:nth-child(3) .meta-value'
      ),
      editedAt: document.querySelector(
        '.questionnaire-meta .meta-item:nth-child(4) .meta-value'
      ),
      tbody: document.querySelector('#questionnaireTable tbody'),
      card: document.getElementById('questionnaire-questions-card'),
      container: document.querySelector('.questionnaire-view-container'),
      feedback: document.getElementById('resultMessage'),
      cancelBtn: document.getElementById('qr-detail-cancel-btn'),
      saveBtn: document.getElementById('qr-detail-save-btn'),
      actionsContainer: document.getElementById('qr-detail-actions')
    }
  }

  // Utilitaires
  $ (sel, root = document) {
    return root.querySelector(sel)
  }

  $$ (sel, root = document) {
    return Array.from(root.querySelectorAll(sel))
  }

  showMessage (msg, type = 'info') {
    if (!this.elements.feedback) return
    this.elements.feedback.textContent = msg
    this.elements.feedback.dataset.type = type
  }

  init () {
    // Masquer le composant si pas de questionnaire sélectionné
    if (!this.isValidQuestionnaireId(this.questionnaireId)) {
      this.hideComponent()
      return
    }

    // Charger les détails du questionnaire
    this.loadQuestionnaireDetails(this.questionnaireId)

    // Écouter les événements de rafraîchissement
    this.setupEventListeners()
  }

  setupEventListeners () {
    // Rafraîchissement du détail du questionnaire
    window.addEventListener('questionnaire:refresh-detail', () => {
      if (this.questionnaireId) {
        this.loadQuestionnaireDetails(this.questionnaireId)
      }
    })

    // Changement de questionnaire sélectionné
    window.addEventListener('questionnaire:changed', e => {
      if (e.detail?.id) {
        this.questionnaireId = e.detail.id
        this.loadQuestionnaireDetails(e.detail.id)
      }
    })

    // Boutons Annuler / Valider
    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.addEventListener('click', () =>
        this.cancelChanges()
      )
    }

    if (this.elements.saveBtn) {
      this.elements.saveBtn.addEventListener('click', () => this.saveChanges())
    }
  }

  isValidQuestionnaireId (id) {
    return id && id !== 'None' && id !== 'null' && id !== ''
  }

  hideComponent () {
    if (this.elements.container) {
      this.elements.container.style.display = 'none'
    }
  }

  showComponent () {
    if (this.elements.container) {
      this.elements.container.style.display = 'block'
    }
  }

  async loadQuestionnaireDetails (id) {
    if (!this.isValidQuestionnaireId(id)) {
      this.hideComponent()
      return
    }

    try {
      this.questionnaireId = id
      this.showComponent()
      this.showLoader()

      // Récupérer les données du questionnaire
      const questionnaire = await this.apiService.fetchQuestionnaire(id)
      this.currentQuestionnaire = questionnaire

      // Initialiser le brouillon avec les questions actuelles
      this.draftQuestions = [...(questionnaire.questions || [])]
      this.hasUnsavedChanges = false

      // Mettre à jour l'affichage
      this.updateHeader(questionnaire)
      await this.renderTable(this.draftQuestions)
      this.updateActionButtons()
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error)
      this.showError('Impossible de charger les détails du questionnaire')
    }
  }

  showLoader () {
    if (this.elements.title) {
      this.elements.title.textContent = 'Chargement...'
    }
    if (this.elements.tbody) {
      this.elements.tbody.innerHTML =
        '<tr><td colspan="4" style="text-align: center;">Chargement...</td></tr>'
    }
  }

  showError (message) {
    if (this.elements.title) {
      this.elements.title.textContent = message
      this.elements.title.style.color = 'red'
    }
  }

  updateHeader (questionnaire) {
    // Titre
    if (this.elements.title) {
      this.elements.title.textContent = questionnaire.title || 'Sans titre'
      this.elements.title.style.color = ''
    }

    // Sujets
    if (this.elements.subjects) {
      this.elements.subjects.textContent = this.formatArray(
        questionnaire.subjects
      )
    }

    // Usages
    if (this.elements.uses) {
      this.elements.uses.textContent = this.formatArray(questionnaire.uses)
    }

    // Date de création
    if (this.elements.createdAt) {
      this.elements.createdAt.textContent = this.formatDateTime(
        questionnaire.created_at
      )
    }

    // Date de modification
    if (this.elements.editedAt) {
      this.elements.editedAt.textContent = this.formatDateTime(
        questionnaire.edited_at
      )
    }
  }

  async renderTable (questions = []) {
    if (!this.elements.tbody) return

    // Vider le tableau
    this.elements.tbody.innerHTML = ''

    // Si pas de questions
    if (!questions || questions.length === 0) {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.colSpan = 4
      td.textContent = 'Aucune question dans ce questionnaire'
      td.style.textAlign = 'center'
      td.style.fontStyle = 'italic'
      tr.appendChild(td)
      this.elements.tbody.appendChild(tr)

      if (this.elements.card) {
        this.elements.card.style.display = 'block'
      }
      return
    }

    // Afficher les questions du brouillon
    for (const [index, question] of questions.entries()) {
      const tr = document.createElement('tr')

      // Colonnes de données
      const columns = [
        { content: index + 1 },
        { content: this.formatId(question.id) },
        { content: question.question || '-' }
      ]

      columns.forEach(col => {
        const td = document.createElement('td')
        td.textContent = col.content
        tr.appendChild(td)
      })

      // Colonne des actions
      const actionsCell = document.createElement('td')
      const actions = this.getActionsForQuestion(
        question,
        index,
        questions.length
      )
      actions.forEach(action => actionsCell.appendChild(action))
      tr.appendChild(actionsCell)

      this.elements.tbody.appendChild(tr)
    }

    // Afficher la carte
    if (this.elements.card) {
      this.elements.card.style.display = 'block'
    }
  }

  // Création des boutons d'action
  createActionButton ({
    src,
    title,
    onClick,
    disabled = false,
    deleteClass = false
  }) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'action-icon-btn'
    btn.className += deleteClass ? ' delete' : ''
    btn.title = title
    btn.setAttribute('aria-label', title)

    if (disabled) {
      btn.disabled = true
      btn.classList.add('disabled')
    }

    const img = new Image()
    img.src = src
    img.alt = title

    btn.appendChild(img)
    btn.addEventListener('click', e => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) onClick()
    })

    return btn
  }

  // Gestion des actions
  getActionsForQuestion (question, index, totalQuestions) {
    const actions = []

    // Action "Monter"
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-q-up.svg',
        title: 'Monter la question',
        onClick: () => this.moveQuestion(index, -1),
        disabled: index === 0
      })
    )

    // Action "Descendre"
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-q-down.svg',
        title: 'Descendre la question',
        onClick: () => this.moveQuestion(index, 1),
        disabled: index === totalQuestions - 1
      })
    )

    // Action "Supprimer"
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-q-unselect.svg',
        title: 'Retirer la question',
        onClick: () => this.removeQuestion(question.id, question.question),
        deleteClass: true
      })
    )

    return actions
  }

  async moveQuestion (fromIndex, direction) {
    const toIndex = fromIndex + direction

    // Vérifier les limites
    if (toIndex < 0 || toIndex >= this.draftQuestions.length)
      return // Échanger les positions dans le brouillon
    ;[this.draftQuestions[fromIndex], this.draftQuestions[toIndex]] = [
      this.draftQuestions[toIndex],
      this.draftQuestions[fromIndex]
    ]

    // Marquer comme modifié
    this.hasUnsavedChanges = true

    // Re-rendre le tableau
    await this.renderTable(this.draftQuestions)

    // Mettre à jour l'état des boutons
    this.updateActionButtons()

    // Afficher un message
    this.showMessage('Ordre modifié (non enregistré)', 'info')
  }

  async removeQuestion (questionId, questionText) {
    const shortQuestionText =
      questionText.length > 50
        ? questionText.substring(0, 50) + '...'
        : questionText

    if (
      !confirm(
        `Êtes-vous sûr de vouloir retirer cette question du questionnaire ?\n\n"${shortQuestionText}"`
      )
    ) {
      return
    }

    // Filtrer la question à supprimer du brouillon
    this.draftQuestions = this.draftQuestions.filter(q => q.id !== questionId)

    // Marquer comme modifié
    this.hasUnsavedChanges = true

    // Re-rendre le tableau
    await this.renderTable(this.draftQuestions)

    // Mettre à jour l'état des boutons
    this.updateActionButtons()

    // Afficher un message
    this.showMessage('Question retirée (non enregistré)', 'info')
  }

  // Méthodes de formatage
  formatDateTime (iso) {
    if (!iso) return '-'
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

  formatArray (arr, defaultValue = '-') {
    if (!Array.isArray(arr) || arr.length === 0) return defaultValue
    return arr.join(', ')
  }

  formatId (id) {
    return String(id ?? '').slice(-4)
  }

  // Méthode publique pour ajouter une question au questionnaire
  async addQuestion (questionId) {
    if (!this.currentQuestionnaire) {
      this.showMessage('Aucun questionnaire sélectionné', 'error')
      return false
    }

    // Vérifier si la question n'est pas déjà dans le brouillon
    const existingIds = this.draftQuestions.map(q => q.id)
    if (existingIds.includes(questionId)) {
      this.showMessage('Cette question est déjà dans le questionnaire', 'info')
      return false
    }

    try {
      // Récupérer les détails de la question pour l'ajouter au brouillon
      const questionData = await this.fetchQuestionDetails(questionId)

      // Ajouter au brouillon
      this.draftQuestions.push(questionData)

      // Marquer comme modifié
      this.hasUnsavedChanges = true

      // Re-rendre le tableau
      await this.renderTable(this.draftQuestions)

      // Mettre à jour l'état des boutons
      this.updateActionButtons()

      this.showMessage('Question ajoutée (non enregistré)', 'info')

      return true
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error)
      this.showMessage("Erreur lors de l'ajout de la question", 'error')
      return false
    }
  }

  async fetchQuestionDetails (questionId) {
    // Essayer de récupérer depuis le tableau des questions si disponible
    if (window.tableManager) {
      const questions = window.tableManager.getLoadedData()
      const found = questions.find(q => q.id === questionId)
      if (found) return found
    }

    // Sinon, faire une requête API
    const response = await fetch(
      `${this.config.apiUrl}/question/${questionId}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Question non trouvée')
    }

    return response.json()
  }

  updateActionButtons () {
    if (this.elements.actionsContainer) {
      this.elements.actionsContainer.style.display = 'flex'
    }

    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.disabled = !this.hasUnsavedChanges
    }

    if (this.elements.saveBtn) {
      this.elements.saveBtn.disabled = !this.hasUnsavedChanges
    }
  }

  cancelChanges () {
    if (!this.hasUnsavedChanges) return

    if (!confirm('Êtes-vous sûr de vouloir annuler vos modifications ?')) {
      return
    }

    // Restaurer le brouillon depuis les données originales
    this.draftQuestions = [...(this.currentQuestionnaire.questions || [])]
    this.hasUnsavedChanges = false

    // Re-rendre le tableau
    this.renderTable(this.draftQuestions)

    // Mettre à jour l'état des boutons
    this.updateActionButtons()

    this.showMessage('Modifications annulées', 'info')
  }

  async saveChanges () {
    if (!this.hasUnsavedChanges) return

    try {
      // Préparer les données pour l'API
      const questions = this.draftQuestions.map(q => ({
        id: q.id,
        question: q.question
      }))

      // Appel API PATCH
      await this.apiService.updateQuestionnaire(this.questionnaireId, {
        questions
      })

      // Recharger les détails pour synchroniser
      await this.loadQuestionnaireDetails(this.questionnaireId)

      // Notifier le succès
      this.showMessage('Modifications enregistrées avec succès', 'success')

      // Déclencher un événement pour informer les autres composants
      window.dispatchEvent(
        new CustomEvent('questionnaire:updated', {
          detail: { id: this.questionnaireId }
        })
      )
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
      this.showMessage(
        "Erreur lors de l'enregistrement des modifications",
        'error'
      )
    }
  }

  // Méthode publique pour obtenir les informations du questionnaire actuel
  getCurrentQuestionnaire () {
    return this.currentQuestionnaire
  }

  // Méthode publique pour rafraîchir l'affichage
  refresh () {
    if (this.questionnaireId) {
      return this.loadQuestionnaireDetails(this.questionnaireId)
    }
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier qu'on est sur la page des questions avec le composant detail
  if (document.getElementById('questionnaire-questions-card')) {
    window.questionnaireDetail = new QuestionnaireDetail()
  }
})

export { QuestionnaireDetail }
