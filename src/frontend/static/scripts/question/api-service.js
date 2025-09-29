// api-service.js - Service pour les appels API
export class ApiService {
  constructor(config) {
    this.config = config;
  }

  getAuthHeaders() {
    const storedToken = (typeof localStorage !== 'undefined') ? localStorage.getItem('access_token') : null;
    const token = storedToken || this.config.token;

    if (!token) {
      throw new Error("Token manquant");
    }

    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };
  }

  async fetchJSON(url, options = {}) {
    const defaultOptions = {
      headers: { "Accept": "application/json" }
    };

    // Si c'est une requête authentifiée
    if (options.authenticated !== false) {
      try {
        defaultOptions.headers = { ...defaultOptions.headers, ...this.getAuthHeaders() };
      } catch (error) {
        throw error;
      }
    }

    const res = await fetch(url, { ...defaultOptions, ...options });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    return res.json();
  }

  async fetchQuestion(id) {
    const url = `${this.config.apiUrl}/question/${encodeURIComponent(id)}`;
    return this.fetchJSON(url);
  }

  async updateQuestion(id, payload) {
    const url = `${this.config.apiUrl}/question/${encodeURIComponent(id)}`;
    return this.fetchJSON(url, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }

  async createQuestion(payload) {
    const url = `${this.config.apiUrl}/question`;
    return fetch(url, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async loadSelectData() {
    if (!this.config.apiUrl) {
      console.warn("apiUrl non configuré dans APP_CONFIG");
      return { subjects: [], uses: [] };
    }

    try {
      const [subjects, uses] = await Promise.all([
        this.fetchJSON(`${this.config.apiUrl}/subjects`, { authenticated: false }),
        this.fetchJSON(`${this.config.apiUrl}/uses`, { authenticated: false })
      ]);

      return {
        subjects: Array.isArray(subjects) ? subjects : (subjects?.data || []),
        uses: Array.isArray(uses) ? uses : (uses?.data || [])
      };
    } catch (e) {
      console.warn("Impossible de charger subjects/uses:", e);
      return { subjects: [], uses: [] };
    }
  }
}