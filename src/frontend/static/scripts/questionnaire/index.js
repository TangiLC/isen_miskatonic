// index.js - Gestion du tableau des questionnaires
// Version refactorisée en POO

class QuestionnaireManager {
  constructor() {
    this.config = window.APP_CONFIG || {};
    this.elements = this.getElements();
    this.fullData = [];
    this.init();
  }

  getElements() {
    return {
      loadButton: document.getElementById("loadQuestionnaires"),
      feedback: document.getElementById("resultMessage"),
      scrollCard: document.getElementById("scroll-card"),
      table: document.getElementById("questionnairesTable"),
      tbody: document.querySelector("#questionnairesTable tbody")
    };
  }

  // Utilitaires
  $(sel, root = document) {
    return root.querySelector(sel);
  }

  $$(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  showMessage(msg, type = 'info') {
    if (!this.elements.feedback) return;
    this.elements.feedback.textContent = msg;
    this.elements.feedback.dataset.type = type;
  }

  // Formatage des données
  formatDateTime(iso) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit"
      });
    } catch {
      return iso;
    }
  }

  formatId(id) {
    return String(id ?? "").slice(-4);
  }

  formatArray(arr, defaultValue = "-") {
    if (!Array.isArray(arr) || arr.length === 0) return defaultValue;
    return arr.join(", ");
  }

  // Création des boutons d'action
  createActionButton({ src, title, onClick, disabled = false }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "action-icon-btn";
    btn.title = title;
    btn.setAttribute("aria-label", title);

    if (disabled) {
      btn.disabled = true;
      btn.classList.add("disabled");
    }

    const img = new Image();
    img.src = src;
    img.alt = title;

    btn.appendChild(img);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) onClick();
    });

    return btn;
  }

  // Gestion des actions
  getActionsForQuestionnaire(questionnaire) {
    const actions = [];

    // Action "Voir"
    actions.push(this.createActionButton({
      src: "/static/assets/icon-eye.svg",
      title: "Voir les détails du questionnaire",
      onClick: () => this.handleViewDetails(questionnaire.id)
    }));

    // Action "Éditer" - désactivée si pas le créateur
    const canEdit = String(questionnaire.created_by) === String(this.config.userId);
    actions.push(this.createActionButton({
      src: "/static/assets/icon-edit.svg",
      title: "Éditer le questionnaire",
      onClick: () => this.handleEditQuestionnaire(questionnaire.id),
      disabled: !canEdit
    }));

    // Action "Sélectionner" - désactivée si archivé
    const canSelect = String(questionnaire.status) !== "archive";
    actions.push(this.createActionButton({
      src: "/static/assets/icon-select.svg",
      title: "Sélectionner ce questionnaire",
      onClick: () => this.handleSelectQuestionnaire(questionnaire.id),
      disabled: !canSelect
    }));

    return actions;
  }

  // Handlers d'actions - délégués aux fonctions globales existantes
  handleViewDetails(id) {
    if (typeof view_questionnaire === 'function') {
      view_questionnaire(id);
    } else {
      console.log('Questionnaire:view', id);
    }
  }

  handleEditQuestionnaire(id) {
    if (typeof edit_questionnaire === 'function') {
      edit_questionnaire(id);
    } else {
      console.log('Questionnaire:edit', id);
    }
  }

  handleSelectQuestionnaire(id) {
    
    fetch(`/api/questionnaire/${id}/select`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Sélection échouée');
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Rediriger vers la page d'édition
            //window.location.href = '/questions';
            console.log("Storage success",data)
        }
    })
    .catch(error => {
        console.error('Erreur sélection:', error);
        this.showMessage('Impossible de sélectionner ce questionnaire', 'error');
    });
}

  // Rendu du tableau
  renderTable(data = []) {
    if (!this.elements.tbody) return;

    this.elements.tbody.innerHTML = "";

    for (const item of data) {
      const tr = document.createElement("tr");

      // Colonnes de données
      const columns = [
        { content: this.formatId(item.id) },
        { content: item.title ?? "" },
        { content: this.formatArray(item.subjects) },
        { content: this.formatArray(item.uses) },
        { content: (item.questions || []).length },
        { content: item.created_by ?? "" },
        { content: this.getLastModifiedDate(item) }
      ];

      columns.forEach(col => {
        const td = document.createElement("td");
        td.textContent = col.content;
        tr.appendChild(td);
      });

      // Colonne des actions
      const actionsCell = document.createElement("td");
      const actions = this.getActionsForQuestionnaire(item);
      actions.forEach(action => actionsCell.appendChild(action));
      tr.appendChild(actionsCell);

      this.elements.tbody.appendChild(tr);
    }

    // Affichage conditionnel du conteneur
    if (this.elements.scrollCard) {
      this.elements.scrollCard.style.display = data.length ? "block" : "none";
    }
  }

  getLastModifiedDate(item) {
    if (item.edited_at) {
      return this.formatDateTime(item.edited_at);
    }
    if (item.created_at) {
      return this.formatDateTime(item.created_at);
    }
    return "-";
  }

  // Chargement des données
  async loadQuestionnaires() {
    if (!this.config.apiUrl || !this.config.token) {
      this.showMessage("Configuration API manquante", 'error');
      return;
    }

    this.showMessage("Chargement…");

    try {
      const response = await fetch(`${this.config.apiUrl}/questionnaires`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.config.token}`,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      this.fullData = Array.isArray(data) ? data : [];
      
      this.renderTable(this.fullData);

      const message = this.fullData.length
        ? `Chargement complet : ${this.fullData.length} questionnaires trouvés`
        : "Aucun questionnaire trouvé";
      
      this.showMessage(message);

    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      this.showMessage(`Échec de la requête : ${error.message}`, 'error');
      this.renderTable([]);
    }
  }

  // Méthodes publiques pour l'interaction externe
  refreshTable() {
    this.loadQuestionnaires();
  }

  getLoadedData() {
    return [...this.fullData];
  }

  // Configuration des événements
  setupEventListeners() {
    if (this.elements.loadButton) {
      this.elements.loadButton.addEventListener("click", () => this.loadQuestionnaires());
    }
  }

  // Initialisation
  init() {
    this.setupEventListeners();
    
    // Auto-chargement si configuré
    if (this.config.autoLoad) {
      this.loadQuestionnaires();
    }
  }
}

// Initialisation automatique
document.addEventListener("DOMContentLoaded", () => {
  // Vérifier qu'on est sur la bonne page
  if (document.getElementById("questionnairesTable")) {
    window.questionnaireManager = new QuestionnaireManager();
  }
});