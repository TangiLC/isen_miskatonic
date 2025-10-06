export class QRApiService {
  constructor (config) {
    this.config = config
  }

  getAuthHeaders () {
    const storedToken =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('access_token')
        : null
    const token = storedToken || this.config.token

    if (!token) {
      throw new Error('Token manquant')
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  async fetchJSON (url, options = {}) {
    const defaultOptions = {
      headers: { Accept: 'application/json' }
    }

    // Si c'est une requête authentifiée
    if (options.authenticated !== false) {
      try {
        defaultOptions.headers = {
          ...defaultOptions.headers,
          ...this.getAuthHeaders()
        }
      } catch (error) {
        throw error
      }
    }

    const res = await fetch(url, { ...defaultOptions, ...options })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text}`)
    }

    return res.json()
  }

  /**
   * Récupère un questionnaire par son ID
   * @param {string} id - L'identifiant du questionnaire
   * @returns {Promise<Object>} Le questionnaire
   */
  async fetchQuestionnaire (id) {
    const url = `${this.config.apiUrl}/questionnaire/${encodeURIComponent(
      id
    )}/short`
    return this.fetchJSON(url)
  }

  /**
   * Met à jour un questionnaire existant
   * @param {string} id - L'identifiant du questionnaire
   * @param {Object} payload - Les données à mettre à jour
   * @param {string} [payload.title] - Titre du questionnaire
   * @param {string[]} [payload.subjects] - Sujets du questionnaire
   * @param {string[]} [payload.uses] - Contextes d'utilisation
   * @param {Object} [payload.questions] - Questions à ajouter {id, question, subjects, uses}
   * @param {string} [payload.remark] - Remarque ou commentaire
   * @param {string} [payload.status] - Statut (draft/active/archive)
   * @returns {Promise<Object>} Le questionnaire mis à jour
   */
  async updateQuestionnaire (id, payload) {
    const url = `${this.config.apiUrl}/questionnaire/${encodeURIComponent(id)}`
    return this.fetchJSON(url, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  /**
   * Crée un nouveau questionnaire
   * @param {Object} payload - Les données du questionnaire
   * @param {string} payload.title - Titre du questionnaire (requis)
   * @param {string[]} [payload.subjects] - Sujets du questionnaire
   * @param {string[]} [payload.uses] - Contextes d'utilisation
   * @param {Array<{id: string, question: string}>} [payload.questions] - Liste des questions
   * @param {string} [payload.remark] - Remarque ou commentaire
   * @param {string} [payload.status] - Statut (draft/active/archive)
   * @returns {Promise<Response>} La réponse brute de l'API
   */
  async createQuestionnaire (payload) {
    const url = `${this.config.apiUrl}/questionnaire`
    return fetch(url, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    })
  }

  /**
   * Récupère tous les questionnaires
   * @returns {Promise<Array>} La liste des questionnaires
   */
  async fetchQuestionnaires () {
    const url = `${this.config.apiUrl}/questionnaires`
    return this.fetchJSON(url)
  }

  /**
   * Sélectionne un questionnaire
   * @param {string} id - L'identifiant du questionnaire
   * @returns {Promise<Object>} La réponse de sélection
   */
  async selectQuestionnaire (id) {
    const url = `/api/questionnaire/${encodeURIComponent(id)}/select`
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(res => {
      if (!res.ok) {
        throw new Error('Sélection échouée')
      }
      return res.json()
    })
  }

  /**
   * Charge les données pour les selects (subjects et uses)
   * Utilisé pour les formulaires
   * @returns {Promise<{subjects: Array, uses: Array}>}
   */
  async loadSelectData () {
    if (!this.config.apiUrl) {
      console.warn('apiUrl non configuré dans APP_CONFIG')
      return { subjects: [], uses: [] }
    }

    try {
      const [subjects, uses] = await Promise.all([
        this.fetchJSON(`${this.config.apiUrl}/subjects`, {
          authenticated: false
        }),
        this.fetchJSON(`${this.config.apiUrl}/uses`, { authenticated: false })
      ])

      return {
        subjects: Array.isArray(subjects) ? subjects : subjects?.data || [],
        uses: Array.isArray(uses) ? uses : uses?.data || []
      }
    } catch (e) {
      console.warn('Impossible de charger subjects/uses:', e)
      return { subjects: [], uses: [] }
    }
  }
}
