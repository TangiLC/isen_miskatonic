export class ApiService {
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

  // ========== QUESTIONS ==========

  async fetchQuestion (id) {
    const url = `${this.config.apiUrl}/question/${encodeURIComponent(id)}`
    const data = await this.fetchJSON(url)
    return this.normalizeData(data)
  }

  async updateQuestion (id, payload) {
    const url = `${this.config.apiUrl}/question/${encodeURIComponent(id)}`
    return this.fetchJSON(url, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  async createQuestion (payload) {
    const url = `${this.config.apiUrl}/question`
    return fetch(url, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    })
  }

  // ========== QUESTIONNAIRES ==========

  async fetchQuestionnaireById (id) {
    const url = `${this.config.apiUrl}/questionnaire/${encodeURIComponent(
      id
    )}/short`
    const data = await this.fetchJSON(url)
    return this.normalizeData(data)
  }

  async fetchQuestionnaires () {
    const url = `${this.config.apiUrl}/questionnaires`
    return this.fetchJSON(url)
  }

  async updateQuestionnaire (id, payload) {
    const url = `${this.config.apiUrl}/questionnaire/${encodeURIComponent(id)}`
    return this.fetchJSON(url, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  async createQuestionnaire (payload) {
    const url = `${this.config.apiUrl}/questionnaire`
    return fetch(url, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    })
  }

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

  // ========== UTILITAIRES ==========

  normalizeData (data) {
    if (!data) return data

    const normalized = { ...data }

    if (normalized.subject && !normalized.subjects) {
      normalized.subjects = normalized.subject
      delete normalized.subject
    }

    if (normalized.use && !normalized.uses) {
      normalized.uses = normalized.use
      delete normalized.use
    }

    return normalized
  }

  async loadSelectData () {
    if (!this.config.apiUrl) {
      console.warn('apiUrl non configuré dans APP_CONFIG')
      return { subjects: [], uses: [] }
    }

    try {
      const [subjects, uses] = await Promise.all([
        this.fetchJSON(`${this.config.apiUrl}/questions/subjects`, {
          authenticated: false
        }),
        this.fetchJSON(`${this.config.apiUrl}/questions/uses`, {
          authenticated: false
        })
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
