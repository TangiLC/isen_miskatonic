class TableManager {
  constructor () {
    this.config = window.APP_CONFIG || {}
    this.elements = this.getElements()
    this.fullData = []
    this.userNameCache = new Map()
    this.init()
  }

  getElements () {
    return {
      loadButton: document.getElementById('loadQ'),
      feedback: document.getElementById('resultMessage'),
      scrollCard: document.getElementById('scroll-card'),
      table: document.getElementById('questionsTable'),
      tbody: document.querySelector('#questionsTable tbody')
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

  // Formatage des données
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

  truncateText (text, maxLength = 50) {
    if (!text) return ''
    const str = String(text)
    return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str
  }

  formatId (id) {
    return String(id ?? '').slice(-4)
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
  getActionsForQuestion (question) {
    const actions = []

    // Action "Voir"
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-eye.svg',
        title: 'Voir les détails',
        onClick: () => this.handleViewDetails(question.id)
      })
    )

    // Action "Éditer" - désactivée si pas le créateur
    const canEdit = String(question.created_by) === String(this.config.userId)
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-edit.svg',
        title: 'Éditer la question',
        onClick: () => this.handleEditQuestion(question.id),
        disabled: !canEdit
      })
    )

    // Action "Ajouter au quiz"
    const canAdd =
      String(question.status) === 'active' &&
      this.config.questionnaireId &&
      this.config.questionnaireId !== 'null' &&
      this.config.questionnaireId !== 'None' &&
      this.config.questionnaireId !== ''
    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-q-add.svg',
        title: 'Ajouter au quizz',
        onClick: () => this.handleAddToQuiz(question),
        disabled: !canAdd
      })
    )

    return actions
  }

  // Handlers d'actions - délégués aux fonctions globales existantes
  handleViewDetails (id) {
    if (typeof see_details === 'function') {
      see_details(id)
    } else {
      console.error('Fonction see_details non trouvée')
    }
  }

  handleEditQuestion (id) {
    if (typeof edit_question === 'function') {
      edit_question(id)
    } else {
      console.error('Fonction edit_question non trouvée')
    }
  }

  handleAddToQuiz (question) {
    // Utiliser le composant questionnaireDetail pour ajouter la question
    if (window.questionnaireDetail) {
      window.questionnaireDetail.addQuestion(question.id)
    } else {
      console.error('Module questionnaireDetail non disponible')
      this.showMessage(
        "Impossible d'ajouter la question au questionnaire",
        'error'
      )
    }
  }

  async getUserNameFromCache (userId) {
    if (this.userNameCache.has(userId)) {
      return this.userNameCache.get(userId)
    }

    const response = await fetch(`/api/users/${userId}/name`)
    const result = await response.json()
    const userName = result.userName || 'Inconnu'
    this.userNameCache.set(userId, userName)
    return userName
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
        { content: this.truncateText(item.question, 50) },
        { content: item.subject ?? '' },
        { content: item.use ?? '' },
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
      const actions = this.getActionsForQuestion(item)
      actions.forEach(action => actionsCell.appendChild(action))
      tr.appendChild(actionsCell)

      this.elements.tbody.appendChild(tr)
    }

    // Affichage conditionnel du conteneur
    if (this.elements.scrollCard) {
      this.elements.scrollCard.style.display = data.length
        ? 'inline-block'
        : 'none'
    }
  }

  getLastModifiedDate (item) {
    const created = item.created_at ? new Date(item.created_at).getTime() : 0
    const edited = item.edited_at ? new Date(item.edited_at).getTime() : 0
    const lastDate = Math.max(created, edited) || Date.now()
    return this.formatDateTime(new Date(lastDate).toISOString())
  }

  // Chargement des données
  async loadQuestions () {
    if (!this.config.apiUrl || !this.config.token) {
      this.showMessage('Configuration API manquante', 'error')
      return
    }

    this.showMessage('Chargement…')

    try {
      const response = await fetch(`${this.config.apiUrl}/questions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`)
      }

      const data = await response.json()
      this.fullData = Array.isArray(data) ? data : []

      this.renderTable(this.fullData)

      const message = this.fullData.length
        ? `Chargement complet : ${this.fullData.length} questions trouvées`
        : 'Aucune question trouvée'

      this.showMessage(message)
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
      this.showMessage(`Échec de la requête : ${error.message}`, 'error')
      this.renderTable([])
    }
  }

  // Méthodes publiques pour l'interaction externe
  refreshTable () {
    this.loadQuestions()
  }

  getLoadedData () {
    return [...this.fullData]
  }

  // Configuration des événements
  setupEventListeners () {
    if (this.elements.loadButton) {
      this.elements.loadButton.addEventListener('click', () =>
        this.loadQuestions()
      )
    }
  }

  // Initialisation
  init () {
    this.setupEventListeners()

    // Auto-chargement si configuré
    if (this.config.autoLoad) {
      this.loadQuestions()
    }
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier qu'on est sur la bonne page
  if (document.getElementById('questionsTable')) {
    window.tableManager = new TableManager()
    window.tableManager.loadQuestions()
  }
})
