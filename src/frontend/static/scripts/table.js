class TableManager {
  constructor () {
    this.config = window.APP_CONFIG || {}
    this.elements = this.getElements()
    this.fullData = []
    this.userNameCache = new Map()
    this.activeSubjects = new Set() // Sujets actifs pour le filtrage
    this.allSubjects = [] // Liste de tous les sujets disponibles
    this.activeUses = new Set() // Uses actifs pour le filtrage
    this.allUses = [] // Liste de tous les uses disponibles
    this.init()
  }

  getElements () {
    return {
      loadButton: document.getElementById('loadQ'),
      feedback: document.getElementById('resultMessage'),
      scrollCard: document.getElementById('scroll-card'),
      table: document.getElementById('questionsTable'),
      tbody: document.querySelector('#questionsTable tbody'),
      subjectFilters: document.getElementById('subject-filters'),
      useFilters: document.getElementById('use-filters'),
      resetFiltersBtn: document.getElementById('reset-filters')
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

  // Handlers d'actions
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

  // === GESTION DES FILTRES SUBJECTS ===

  async loadSubjects () {
    try {
      const response = await fetch(`${this.config.apiUrl}/questions/subjects`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`)
      }

      this.allSubjects = await response.json()

      // Tous les sujets sont actifs par défaut
      this.activeSubjects = new Set(this.allSubjects)

      this.renderSubjectFilters()
    } catch (error) {
      console.error('Erreur lors du chargement des sujets:', error)
    }
  }

  renderSubjectFilters () {
    if (!this.elements.subjectFilters) return

    this.elements.subjectFilters.innerHTML = ''

    this.allSubjects.forEach(subject => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'subject-filter-btn'
      btn.textContent = subject
      btn.dataset.subject = subject

      // État actif par défaut
      if (!this.activeSubjects.has(subject)) {
        btn.classList.add('inactive')
      }

      btn.addEventListener('click', () => this.toggleSubjectFilter(subject))
      this.elements.subjectFilters.appendChild(btn)
    })
  }

  toggleSubjectFilter (subject) {
    if (this.activeSubjects.has(subject)) {
      this.activeSubjects.delete(subject)
    } else {
      this.activeSubjects.add(subject)
    }

    // Mise à jour visuelle du bouton
    const btn = this.elements.subjectFilters.querySelector(
      `[data-subject="${subject}"]`
    )
    if (btn) {
      btn.classList.toggle('inactive')
    }

    // Appliquer le filtre
    this.applyFilters()
  }

  // === GESTION DES FILTRES USES ===

  async loadUses () {
    try {
      const response = await fetch(`${this.config.apiUrl}/questions/uses`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`)
      }

      this.allUses = await response.json()

      // Tous les uses sont actifs par défaut
      this.activeUses = new Set(this.allUses)

      this.renderUseFilters()
    } catch (error) {
      console.error('Erreur lors du chargement des uses:', error)
    }
  }

  renderUseFilters () {
    if (!this.elements.useFilters) return

    this.elements.useFilters.innerHTML = ''

    this.allUses.forEach(use => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'use-filter-btn'
      btn.textContent = use
      btn.dataset.use = use

      // État actif par défaut
      if (!this.activeUses.has(use)) {
        btn.classList.add('inactive')
      }

      btn.addEventListener('click', () => this.toggleUseFilter(use))
      this.elements.useFilters.appendChild(btn)
    })
  }

  toggleUseFilter (use) {
    if (this.activeUses.has(use)) {
      this.activeUses.delete(use)
    } else {
      this.activeUses.add(use)
    }

    // Mise à jour visuelle du bouton
    const btn = this.elements.useFilters.querySelector(`[data-use="${use}"]`)
    if (btn) {
      btn.classList.toggle('inactive')
    }

    // Appliquer le filtre
    this.applyFilters()
  }

  // === GESTION COMBINÉE DES FILTRES ===

  resetFilters () {
    // Réactiver tous les sujets et uses
    this.activeSubjects = new Set(this.allSubjects)
    this.activeUses = new Set(this.allUses)

    // Mise à jour visuelle
    this.$$('.subject-filter-btn, .use-filter-btn').forEach(btn => {
      btn.classList.remove('inactive')
    })

    // Réafficher toutes les questions
    this.applyFilters()
  }

  applyFilters () {
    // Filtrer les questions selon les sujets ET uses actifs
    const filteredData = this.fullData.filter(question => {
      // Vérifier les sujets
      const subjects = Array.isArray(question.subject)
        ? question.subject
        : [question.subject]

      const matchesSubject =
        this.activeSubjects.size === 0 ||
        subjects.some(s => this.activeSubjects.has(s))

      // Vérifier les uses
      const uses = Array.isArray(question.use) ? question.use : [question.use]

      const matchesUse =
        this.activeUses.size === 0 || uses.some(u => this.activeUses.has(u))

      // La question doit correspondre aux deux critères
      return matchesSubject && matchesUse
    })

    this.renderTable(filteredData)
  }

  // === FIN GESTION DES FILTRES ===

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

      this.applyFilters()

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

    if (this.elements.resetFiltersBtn) {
      this.elements.resetFiltersBtn.addEventListener('click', () =>
        this.resetFilters()
      )
    }
  }

  // Initialisation
  async init () {
    this.setupEventListeners()

    // Charger les sujets et uses
    await this.loadSubjects()
    await this.loadUses()

    // Auto-chargement si configuré
    if (this.config.autoLoad) {
      await this.loadQuestions()
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
