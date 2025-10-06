import { QRApiService } from './api-service.js'

class QuestionnaireManager {
  constructor () {
    this.config = window.APP_CONFIG || {}
    this.elements = this.getElements()
    this.fullData = []
    this.userNameCache = new Map()

    // Initialisation du service API
    this.apiService = new QRApiService(this.config)

    this.init()
  }

  getElements () {
    return {
      loadButton: document.getElementById('loadQR'),
      feedback: document.getElementById('resultMessage'),
      scrollCard: document.getElementById('scroll-card'),
      table: document.getElementById('questionnairesTable'),
      tbody: document.querySelector('#questionnairesTable tbody')
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
    this.elements.feedback.classList.remove('success', 'error', 'info')
    this.elements.feedback.classList.add(type)
  }

  // Formatage des données
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

  formatId (id) {
    return String(id ?? '').slice(-4)
  }

  formatArray (arr, defaultValue = '-') {
    if (!Array.isArray(arr) || arr.length === 0) return defaultValue
    return arr.join(', ')
  }

  // Création des boutons d'action
  createActionButton ({ src, title, onClick, disabled = false }) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'action-icon-btn'
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

  // Handlers d'actions
  handleViewDetails (id) {
    if (typeof view_questionnaire === 'function') {
      view_questionnaire(id)
    } else {
      console.log('Questionnaire:view', id)
    }
  }

  handleEditQuestionnaire (id) {
    if (typeof edit_questionnaire === 'function') {
      edit_questionnaire(id)
    } else {
      console.log('Questionnaire:edit', id)
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
        }, 3000)
      }
    } catch (error) {
      console.error('Erreur sélection:', error)
      this.showMessage('Impossible de sélectionner ce questionnaire', 'error')
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

  // Rendu du tableau
  async renderTable (data = []) {
    if (!this.elements.tbody) return

    this.elements.tbody.innerHTML = ''

    for (const item of data) {
      const tr = document.createElement('tr')
      const creatorName = await this.getUserNameFromCache(item.created_by)

      // Colonnes de données
      const columns = [
        { content: this.formatId(item.id) },
        { content: item.title ?? '' },
        { content: this.formatArray(item.subjects) },
        { content: this.formatArray(item.uses) },
        { content: (item.questions || []).length },
        { content: creatorName },
        { content: this.getLastModifiedDate(item) }
      ]

      columns.forEach(col => {
        const td = document.createElement('td')
        td.textContent = col.content
        tr.appendChild(td)
      })

      // Colonne des actions
      const actionsCell = document.createElement('td')
      const actions = this.getActionsForQuestionnaire(item)
      actions.forEach(action => actionsCell.appendChild(action))
      tr.appendChild(actionsCell)

      this.elements.tbody.appendChild(tr)
    }

    // Affichage conditionnel du conteneur
    if (this.elements.scrollCard) {
      this.elements.scrollCard.style.display = data.length ? 'block' : 'none'
    }
  }

  getLastModifiedDate (item) {
    if (item.edited_at) {
      return this.formatDateTime(item.edited_at)
    }
    if (item.created_at) {
      return this.formatDateTime(item.created_at)
    }
    return '-'
  }

  // Chargement des données via ApiService
  async loadQuestionnaires () {
    if (!this.config.apiUrl || !this.config.token) {
      this.showMessage('Configuration API manquante', 'error')
      return
    }

    this.showMessage('Chargement…')

    try {
      const data = await this.apiService.fetchQuestionnaires()
      this.fullData = Array.isArray(data) ? data : []

      await this.renderTable(this.fullData)

      const message = this.fullData.length
        ? `Chargement complet : ${this.fullData.length} questionnaires trouvés`
        : 'Aucun questionnaire trouvé'

      this.showMessage(message, 'success')
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
      this.showMessage(`Échec de la requête : ${error.message}`, 'error')
      this.renderTable([])
    }
  }

  // Méthodes publiques pour l'interaction externe
  refreshTable () {
    return this.loadQuestionnaires()
  }

  getLoadedData () {
    return [...this.fullData]
  }

  /**
   * Ouvre le modal de détails d'un questionnaire
   * @param {string} id - L'identifiant du questionnaire
   * @param {string} mode - 'view' ou 'edit'
   */
  async openQuestionnaireModal (id, mode) {
    try {
      this.showMessage('')
      const data = await this.apiService.fetchQuestionnaire(id)

      // Émet un événement custom pour le module modal/form
      const event = new CustomEvent('questionnaire:open-modal', {
        detail: { questionnaire: data, mode }
      })
      window.dispatchEvent(event)

      this.showMessage(`Questionnaire ${id} chargé`, 'info')
    } catch (error) {
      this.showMessage(`Erreur chargement: ${error.message}`, 'error')
    }
  }

  /**
   * Met à jour un questionnaire
   * @param {string} id - L'identifiant du questionnaire
   * @param {Object} payload - Les données à mettre à jour
   */
  async updateQuestionnaire (id, payload) {
    try {
      await this.apiService.updateQuestionnaire(id, payload)
      this.showMessage(`Questionnaire ${id} modifié avec succès`, 'success')

      // Rafraîchir le tableau
      await this.refreshTable()

      return true
    } catch (error) {
      this.showMessage(`Erreur modification: ${error.message}`, 'error')
      return false
    }
  }

  /**
   * Crée un nouveau questionnaire
   * @param {Object} payload - Les données du questionnaire
   */
  async createQuestionnaire (payload) {
    try {
      const response = await this.apiService.createQuestionnaire(payload)

      const isJson = (response.headers.get('content-type') || '').includes(
        'application/json'
      )
      const body = isJson ? await response.json() : await response.text()

      if (response.status === 201) {
        this.showMessage('Questionnaire créé avec succès', 'success')
        await this.refreshTable()

        return { success: true, data: body }
      }

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

      this.showMessage(errorMsg, 'error')
      return { success: false, error: errorMsg }
    } catch (error) {
      console.error('Erreur lors de la création:', error)
      this.showMessage("Impossible d'atteindre le serveur.", 'error')
      return { success: false, error: error.message }
    }
  }

  // Configuration des événements
  setupEventListeners () {
    if (this.elements.loadButton) {
      this.elements.loadButton.addEventListener('click', () =>
        this.loadQuestionnaires()
      )
    }

    window.addEventListener('questionnaire:refresh', () => {
      this.refreshTable()
    })

    window.addEventListener('questionnaire:view', e => {
      if (e.detail?.id) {
        this.openQuestionnaireModal(e.detail.id, 'view')
      }
    })

    window.addEventListener('questionnaire:edit', e => {
      if (e.detail?.id) {
        this.openQuestionnaireModal(e.detail.id, 'edit')
      }
    })
  }

  // Initialisation
  init () {
    this.setupEventListeners()
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier qu'on est sur la bonne page
  if (document.getElementById('questionnairesTable')) {
    window.questionnaireManager = new QuestionnaireManager()
    window.questionnaireManager.loadQuestionnaires()
  }
})

// Export pour utilisation en module
export { QuestionnaireManager }
