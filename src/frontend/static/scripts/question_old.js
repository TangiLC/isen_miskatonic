// question.js - Gestion des questions avec modal
// Version refactorisée et simplifiée

class QuestionManager {
  constructor() {
    this.config = window.APP_CONFIG || {};
    this.elements = this.getElements();
    this.init();
  }

  getElements() {
    return {
      createButton: document.getElementById("createQ"),
      modal: document.getElementById("question-modal"),
      closeBtn: document.getElementById("q-close-btn"),
      form: document.getElementById("question-form"),
      submitBtn: document.getElementById("submit-btn"),
      resetBtn: document.getElementById("reset-btn"),
      
      // Inputs
      questionInput: document.getElementById("q-question-input"),
      subjectSelect: document.getElementById("q-subject-select"),
      useSelect: document.getElementById("q-use-select"),
      remarkInput: document.getElementById("q-remark-input"),
      statusSelect: document.getElementById("q-status-select"),
      
      // Subject/Use management
      subjectAdd: document.getElementById("q-subject-add"),
      subjectAddBtn: document.getElementById("q-subject-add-btn"),
      useAdd: document.getElementById("q-use-add"),
      useAddBtn: document.getElementById("q-use-add-btn"),
      
      // Responses
      responsesList: document.getElementById("responses-list"),
      addResponseBtn: document.getElementById("add-response-btn"),
      
      // Feedback
      feedback: document.getElementById("feedback"),
      debugOutput: document.getElementById("debug-output")
    };
  }

  // Utilitaires
  $(sel, root = document) {
    return root.querySelector(sel);
  }

  $$(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  async fetchJSON(url) {
    const res = await fetch(url, { 
      headers: { "Accept": "application/json" } 
    });
    if (!res.ok) throw new Error(`Erreur HTTP ${res.status} sur ${url}`);
    return res.json();
  }

  showMessage(msg, type = 'info') {
    if (!this.elements.feedback) return;
    this.elements.feedback.textContent = msg;
    this.elements.feedback.dataset.type = type;
  }

  // Gestion des options de select
  fillSelectOptions(selectEl, values) {
    if (!selectEl) return;
    
    const seen = new Set();
    values.forEach(v => {
      const val = String(v).trim();
      if (!val || seen.has(val)) return;
      seen.add(val);
      
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      selectEl.appendChild(opt);
    });
  }

  addOptionIfMissing(selectEl, value) {
    if (!selectEl) return;
    
    const val = String(value || "").trim();
    if (!val) return;
    
    const exists = this.$$("option", selectEl).some(o => o.value === val);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      selectEl.appendChild(opt);
    }
    
    this.$$("option", selectEl).forEach(o => {
      o.selected = (o.value === val);
    });
  }

  collectMultiSelect(selectEl) {
    if (!selectEl) return [];
    return this.$$("option:checked", selectEl).map(o => o.value);
  }

  // Gestion des réponses
  addResponseRow(defaultText = "", isCorrect = false) {
    const template = document.getElementById("response-row-tpl");
    if (!template || !this.elements.responsesList) return;
    
    const node = template.content.firstElementChild.cloneNode(true);
    const input = this.$(".response-input", node);
    const checkbox = this.$(".response-correct", node);
    const removeBtn = this.$(".remove-response", node);
    
    if (input) input.value = defaultText;
    if (checkbox) checkbox.checked = !!isCorrect;
    
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        node.remove();
        this.validateForm();
        this.updateStatusOptions();
      });
    }
    
    // Ajouter les listeners pour la validation
    if (input) {
      input.addEventListener("input", () => this.validateForm());
    }
    if (checkbox) {
      checkbox.addEventListener("change", () => {
        this.validateForm();
        this.updateStatusOptions();
      });
    }
    
    this.elements.responsesList.appendChild(node);
    this.validateForm();
    this.updateStatusOptions();
  }

  getResponsesData() {
    const rows = this.$$(".response-row");
    const responses = [];
    const corrects = [];
    
    rows.forEach(row => {
      const input = this.$(".response-input", row);
      const checkbox = this.$(".response-correct", row);
      
      if (input && input.value.trim()) {
        const value = input.value.trim();
        responses.push(value);
        
        if (checkbox && checkbox.checked) {
          corrects.push(value);
        }
      }
    });
    
    return { responses, corrects };
  }

  // Validation du formulaire
  validateForm() {
    if (!this.elements.submitBtn) return;
    
    const questionFilled = (this.elements.questionInput?.value || "").trim().length > 0;
    const subjectFilled = this.collectMultiSelect(this.elements.subjectSelect).length > 0;
    const useFilled = this.collectMultiSelect(this.elements.useSelect).length > 0;
    const { responses, corrects } = this.getResponsesData();
    const hasResponses = responses.length > 0;
    const hasCorrects = corrects.length > 0;
    const currentStatus = this.elements.statusSelect?.value || "draft";
    
    let isValid = false;
    
    if (currentStatus === "draft") {
      // En mode brouillon : seuls les champs de base sont requis
      isValid = questionFilled && subjectFilled && useFilled && hasResponses;
    } else if (currentStatus === "active" || currentStatus === "archive") {
      // En mode actif/archivé : tous les champs obligatoires + au moins une réponse correcte
      isValid = questionFilled && subjectFilled && useFilled && hasResponses && hasCorrects;
    }
    
    this.elements.submitBtn.disabled = !isValid;
  }

  // Gestion du statut selon les réponses correctes
  updateStatusOptions() {
    if (!this.elements.statusSelect) return;
    
    const { corrects } = this.getResponsesData();
    const hasCorrect = corrects.length > 0;
    
    const activeOpt = this.elements.statusSelect.querySelector('option[value="active"]');
    const archiveOpt = this.elements.statusSelect.querySelector('option[value="archive"]');
    
    [activeOpt, archiveOpt].forEach(opt => {
      if (!opt) return;
      opt.disabled = !hasCorrect;
      if (!hasCorrect && opt.selected) {
        this.elements.statusSelect.value = "draft";
      }
    });
    
    // Revalider le formulaire après changement de statut
    this.validateForm();
  }

  // Construction du payload
  buildQuestionPayload() {
    const { responses, corrects } = this.getResponsesData();
    
    return {
      id: null,
      question: this.elements.questionInput?.value.trim() || "",
      subject: this.collectMultiSelect(this.elements.subjectSelect),
      use: this.collectMultiSelect(this.elements.useSelect),
      responses,
      corrects,
      remark: this.elements.remarkInput?.value.trim() || null,
      status: this.elements.statusSelect?.value || "draft",
      created_by: null,
      created_at: null,
      edited_at: null
    };
  }

  showDebug(payload) {
    if (this.elements.debugOutput) {
      this.elements.debugOutput.textContent = JSON.stringify(payload, null, 2);
    }
  }

  // Chargement des données
  async loadSelectData() {
    if (!this.config.apiUrl) {
      console.warn("apiUrl non configuré dans APP_CONFIG");
      return;
    }
    
    try {
      const [subjects, uses] = await Promise.all([
        this.fetchJSON(`${this.config.apiUrl}/subjects`),
        this.fetchJSON(`${this.config.apiUrl}/uses`)
      ]);
      
      this.fillSelectOptions(
        this.elements.subjectSelect, 
        Array.isArray(subjects) ? subjects : (subjects?.data || [])
      );
      
      this.fillSelectOptions(
        this.elements.useSelect, 
        Array.isArray(uses) ? uses : (uses?.data || [])
      );
      
      console.log("Données chargées:", { subjects, uses });
    } catch (e) {
      console.warn("Impossible de charger subjects/uses depuis", this.config.apiUrl, ":", e);
    }
  }

  // Gestion du modal
  openModal() {
    if (this.elements.modal) {
      this.elements.modal.style.display = "inline-flex";
      setTimeout(() => {
        this.validateForm();
        this.updateStatusOptions();
      }, 0);
    }
  }

  closeModal() {
    if (this.elements.modal) {
      this.elements.modal.style.display = "none";
    }
  }

  // Réinitialisation du formulaire
  resetForm() {
    if (this.elements.questionInput) this.elements.questionInput.value = "";
    if (this.elements.remarkInput) this.elements.remarkInput.value = "";
    if (this.elements.statusSelect) this.elements.statusSelect.value = "draft";
    
    [this.elements.subjectSelect, this.elements.useSelect].forEach(select => {
      if (select) {
        this.$$(":checked", select).forEach(o => o.selected = false);
      }
    });
    
    if (this.elements.responsesList) {
      this.elements.responsesList.innerHTML = "";
      this.addResponseRow();
      this.addResponseRow();
    }
    
    this.showDebug({});
    this.validateForm();
    this.updateStatusOptions();
  }

  // Soumission du formulaire
  async submitForm(evt) {
    evt.preventDefault();
    
    const payload = this.buildQuestionPayload();
    const currentStatus = payload.status || "draft";
    
    // Validation côté client selon le statut
    if (!payload.question) {
      this.showMessage("Veuillez saisir l'intitulé de la question.", 'error');
      return;
    }
    if (payload.subject.length === 0) {
      this.showMessage('Veuillez renseigner au moins un sujet.', 'error');
      return;
    }
    if (payload.use.length === 0) {
      this.showMessage('Veuillez renseigner au moins un usage.', 'error');
      return;
    }
    if (payload.responses.length === 0) {
      this.showMessage('Veuillez fournir au moins une proposition de réponse.', 'error');
      return;
    }
    
    // Validation des réponses correctes uniquement pour les statuts "active" et "archive"
    if (currentStatus === "active" || currentStatus === "archive") {
      if (payload.corrects.length === 0) {
        this.showMessage('Une réponse correcte est obligatoire pour le statut "actif" ou "archivé".', 'error');
        return;
      }
      
      // Vérification que les réponses correctes sont dans les propositions
      const correctsNotInResponses = payload.corrects.filter(c => !payload.responses.includes(c));
      if (correctsNotInResponses.length > 0) {
        this.showMessage("Les réponses correctes doivent faire partie des propositions.", 'error');
        return;
      }
    }

    // Vérification de l'apiUrl
    if (!this.config.apiUrl) {
      this.showMessage('Configuration API manquante.', 'error');
      return;
    }

    // Récupération du token
    const storedToken = (typeof localStorage !== 'undefined') ? localStorage.getItem('access_token') : null;
    const token = storedToken || this.config.token;
    
    if (!token) {
      this.showMessage('Token manquant. Connectez-vous pour récupérer un JWT.', 'error');
      return;
    }

    try {
      this.showMessage('Envoi en cours…');
      
      const apiUrl = `${this.config.apiUrl}/question`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const isJson = (response.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await response.json() : await response.text();

      if (response.status === 201) {
        let statusText = '';
        switch(currentStatus) {
          case 'draft': statusText = ' en brouillon'; break;
          case 'active': statusText = ' et activée'; break;
          case 'archive': statusText = ' et archivée'; break;
        }
        this.showMessage(`Question créée avec succès${statusText}.`);
        
        if (body && body.id && this.elements.feedback) {
          const link = document.createElement('a');
          link.href = `${this.config.apiUrl}/question/${encodeURIComponent(body.id)}`;
          link.textContent = 'Voir la ressource';
          link.target = '_blank';
          this.elements.feedback.appendChild(document.createTextNode(' '));
          this.elements.feedback.appendChild(link);
        }
        
        this.resetForm();
        setTimeout(() => this.closeModal(), 2000);
        return;
      }

      // Gestion des erreurs
      const errorMessages = {
        401: 'Authentification requise ou token invalide/expiré.',
        409: 'Conflit lors de la création (doublon possible).',
        422: body?.detail ? JSON.stringify(body.detail) : 'Erreur de validation.'
      };

      const errorMsg = errorMessages[response.status] || 
                     (typeof body === 'string' ? body : body?.message || 'Erreur serveur.');
      
      this.showMessage(errorMsg, 'error');

    } catch (err) {
      console.error('Erreur lors de la soumission:', err);
      this.showMessage("Impossible d'atteindre le serveur.", 'error');
    }
    
    // Debug (à supprimer en production)
    this.showDebug(payload);
  }

  // Initialisation des événements
  setupEventListeners() {
    // Modal
    if (this.elements.createButton) {
      this.elements.createButton.addEventListener("click", () => this.openModal());
    }
    
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener("click", () => this.closeModal());
    }
    
    if (this.elements.modal) {
      this.elements.modal.addEventListener("click", (e) => {
        if (e.target === this.elements.modal) this.closeModal();
      });
    }
    
    // Échap pour fermer le modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.elements.modal?.style.display !== "none") {
        this.closeModal();
      }
    });
    
    // Ajout d'options
    if (this.elements.subjectAddBtn) {
      this.elements.subjectAddBtn.addEventListener("click", () => {
        this.addOptionIfMissing(this.elements.subjectSelect, this.elements.subjectAdd?.value);
        if (this.elements.subjectAdd) this.elements.subjectAdd.value = "";
        this.validateForm();
      });
    }
    
    if (this.elements.useAddBtn) {
      this.elements.useAddBtn.addEventListener("click", () => {
        this.addOptionIfMissing(this.elements.useSelect, this.elements.useAdd?.value);
        if (this.elements.useAdd) this.elements.useAdd.value = "";
        this.validateForm();
      });
    }
    
    // Ajout de réponse
    if (this.elements.addResponseBtn) {
      this.elements.addResponseBtn.addEventListener("click", () => this.addResponseRow());
    }
    
    // Soumission
    if (this.elements.submitBtn) {
      this.elements.submitBtn.addEventListener("click", (e) => this.submitForm(e));
    }
    
    if (this.elements.form) {
      this.elements.form.addEventListener("submit", (e) => this.submitForm(e));
    }
    
    // Réinitialisation
    if (this.elements.resetBtn) {
      this.elements.resetBtn.addEventListener("click", () => this.resetForm());
    }
    
    // Validation en temps réel
    [this.elements.questionInput, this.elements.remarkInput].forEach(input => {
      if (input) {
        input.addEventListener("input", () => this.validateForm());
      }
    });
    
    [this.elements.subjectSelect, this.elements.useSelect, this.elements.statusSelect].forEach(select => {
      if (select) {
        select.addEventListener("change", () => this.validateForm());
      }
    });
    
    // Observer pour les changements dans la liste des réponses
    if (this.elements.responsesList && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        this.validateForm();
        this.updateStatusOptions();
      });
      observer.observe(this.elements.responsesList, { childList: true, subtree: true });
    }
  }

  // Initialisation
  async init() {
    await this.loadSelectData();
    
    // Ajouter les réponses par défaut
    this.addResponseRow();
    this.addResponseRow();
    
    this.setupEventListeners();
    this.validateForm();
    this.updateStatusOptions();
  }
}

// Initialisation automatique
document.addEventListener("DOMContentLoaded", () => {
  // Vérifier qu'on est sur la bonne page
  if (document.getElementById("question-detail") || document.getElementById("question-modal")) {
    new QuestionManager();
  }
});