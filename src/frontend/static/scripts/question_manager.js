// question_manager.js - Gestion complète des questions avec modal et helpers intégrés
// Version refactorisée avec POO et helpers intégrés

class QuestionManager {
  constructor() {
    this.config = window.APP_CONFIG || {};
    this.elements = this.getElements();
    this.currentMode = null; // 'create', 'edit', 'view'
    this.currentQuestionId = null;
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

      // Titre et infos
      modalTitle: document.querySelector("#question-modal .question-title h2"),
      infoSections: document.querySelectorAll("#question-modal .q-info > div"),

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
      resultMessage: document.getElementById("resultMessage"),
      debugOutput: document.getElementById("debug-output")
    };
  }

  // ===== UTILITAIRES DE BASE =====
  $(sel, root = document) {
    return root.querySelector(sel);
  }

  $$(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  show(el) {
    if (el) el.style.display = "";
  }

  hide(el) {
    if (el) el.style.display = "none";
  }

  // ===== GESTION DES MESSAGES =====
  showMessage(msg, type = 'info') {
    const target = this.elements.feedback || this.elements.resultMessage;
    if (!target) return;

    target.textContent = msg;
    target.dataset.type = type;
    target.className = type === 'error' ? 'error' : 'success';
  }

  // ===== UTILITAIRES API =====
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

  // ===== GESTION DES FORMULAIRES =====
  setFormDisabled(disabled) {
    const container = this.elements.modal;
    if (!container) return;

    this.$$("input, select, textarea, button", container).forEach(el => {
      // Boutons de fermeture toujours actifs
      if (el.id === "q-close-btn") return;
      if (el.closest(".responses-header")) return;

      // Boutons de réponses et actions
      if (el.classList.contains("remove-response") ||
          el.id === "add-response-btn" ||
          el.closest(".q-buttons")) {
        el.disabled = disabled;
        return;
      }

      // Autres éléments
      if (el.tagName === "INPUT") {
        el.readOnly = disabled;
      } else if (el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
        el.disabled = disabled;
      }
    });
  }

  // ===== GESTION DES MODES DE MODAL =====
  setModalMode(mode, data = {}) {
    this.currentMode = mode;

    // Mise à jour du titre
    if (this.elements.modalTitle) {
      const titles = {
        view: `Détail de la question ${data.id || ''}`,
        edit: `Modification de la question ${data.id || ''}`,
        create: "Création d'une nouvelle question"
      };
      this.elements.modalTitle.textContent = titles[mode] || titles.create;
    }

    // Gestion des boutons
    const isReadonly = mode === "view";

    if (this.elements.submitBtn) {
      if (isReadonly) {
        this.hide(this.elements.submitBtn);
      } else {
        this.show(this.elements.submitBtn);
        this.elements.submitBtn.textContent = mode === "edit" ? "Modifier" : "Enregistrer";
      }
    }

    if (this.elements.resetBtn) {
      if (isReadonly) {
        this.hide(this.elements.resetBtn);
      } else {
        this.show(this.elements.resetBtn);
      }
    }

    // Bouton d'ajout de réponse
    if (this.elements.addResponseBtn) {
      if (isReadonly) {
        this.elements.addResponseBtn.disabled = true;
        this.elements.addResponseBtn.style.visibility = "hidden";
      } else {
        this.elements.addResponseBtn.disabled = false;
        this.elements.addResponseBtn.style.visibility = "visible";
      }
    }

    // Masquer les div q-adder en mode view
    const adderDivs = this.$$(".q-adder");
    adderDivs.forEach(div => {
    if (isReadonly) {
        this.hide(div);
        } else {
        this.show(div);
        }
    });

    // Verrouillage du formulaire
    this.setFormDisabled(isReadonly);
  }

  // ===== GESTION DES DONNÉES DE MODAL =====
  formatDateTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    } catch {
      return iso;
    }
  }

  populateModal(data, mode = 'view') {
    // Champs de base
    if (this.elements.questionInput) this.elements.questionInput.value = data.question || "";
    if (this.elements.remarkInput) this.elements.remarkInput.value = data.remark || "";
    this.currentCorrects = new Set(Array.isArray(data.corrects) ? data.corrects : []);

    // Informations temporelles
    if (this.elements.infoSections && this.elements.infoSections.length >= 3) {
      this.elements.infoSections[1].innerHTML = `Créé le : ${this.formatDateTime(data.created_at)}`;
      this.elements.infoSections[2].innerHTML = `Modifié le : ${this.formatDateTime(data.edited_at)}`;
    }

    // Statut
    if (this.elements.statusSelect && data.status) {
      this.elements.statusSelect.value = data.status;
    }

    // Subjects et Uses
    this.fillSelect(this.elements.subjectSelect, Array.isArray(data.subject) ? data.subject : []);
    this.fillSelect(this.elements.useSelect, Array.isArray(data.use) ? data.use : []);

    // Réponses
    this.clearResponses();
    const responses = Array.isArray(data.responses) ? data.responses : [];
    const corrects = Array.isArray(data.corrects) ? data.corrects : [];
    
    this.currentCorrects = new Set(corrects);

    responses.forEach(response => {
        const isCorrect = corrects.includes(response);
        this.addResponseRow(response, isCorrect, mode === 'view');
    });

    if (mode !== 'view') {
    const minRows = Math.max(2, responses.length === 0 ? 2 : 0);
    for (let i = 0; i < minRows; i++) {
      this.addResponseRow("", false, false);
    }
  }

    // Configuration du mode
    this.setModalMode(mode, data);
    this.show(this.elements.modal);
  }

  collectFormData() {
    const question = this.elements.questionInput?.value.trim() || "";
    const remark = this.elements.remarkInput?.value.trim() || "";
    const status = this.elements.statusSelect?.value || "draft";

    const subject = Array.from(this.elements.subjectSelect?.selectedOptions || []).map(o => o.value);
    const use = Array.from(this.elements.useSelect?.selectedOptions || []).map(o => o.value);

    const { responses, corrects } = this.getResponsesData();

    return { question, subject, use, remark, status, responses, corrects };
  }

  // ===== GESTION DES SELECT MULTIPLES =====
  fillSelect(selectEl, values) {
    if (!selectEl) return;

    // Conserver les options existantes, ajouter celles manquantes
    const existing = new Set(Array.from(selectEl.options).map(o => o.value));
    values.forEach(value => {
      if (!existing.has(value)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        selectEl.appendChild(option);
      }
    });

    // Sélectionner selon les valeurs
    Array.from(selectEl.options).forEach(option => {
      option.selected = values.includes(option.value);
    });
  }

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

  // ===== GESTION DES RÉPONSES =====
  clearResponses() {
    if (this.elements.responsesList) {
      this.elements.responsesList.innerHTML = "";
      //this.addResponseRow();
      //this.addResponseRow();
    }

    this.showDebug({});
    this.validateForm();
    this.updateStatusOptions();
  }

  addResponseRow(defaultText = "", isCorrect = false, readonly = false) {
    const template = document.getElementById("response-row-tpl");
    if (!template || !this.elements.responsesList) return;

    const node = template.content.firstElementChild.cloneNode(true);
    const input = this.$(".response-input", node);
    const checkbox = this.$(".response-correct", node);
    const removeBtn = this.$(".remove-response", node);

    const inputValue = defaultText.trim();
    const shouldBeChecked = isCorrect || (inputValue && this.currentCorrects && this.currentCorrects.has(inputValue));

    if (input)  input.value = defaultText;
          
    if (checkbox) checkbox.checked = shouldBeChecked;

    if (isCorrect) node.classList.add("correct");

    if (readonly) {
      if (input) input.readOnly = true;
      if (checkbox) checkbox.disabled = true;
      if (removeBtn) removeBtn.style.visibility = "hidden";
    } else {
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          node.remove();
          this.validateForm();
          this.updateStatusOptions();
        });
      }
    }

    // Listeners pour la validation
    if (input) {
      input.addEventListener("input", () => {this.validateForm();
      const newValue = input.value.trim();
      const isNowCorrect = newValue && this.currentCorrects && this.currentCorrects.has(newValue);
      
      if (checkbox) checkbox.checked = isNowCorrect;
      if (isNowCorrect) {
        node.classList.add("correct");
      } else {
        node.classList.remove("correct");
      }
    });
    }
    if (checkbox) {
      checkbox.addEventListener("change", () => {
        this.validateForm();
        this.updateStatusOptions();

        if (checkbox.checked) {
        node.classList.add("correct");
      } else {
        node.classList.remove("correct");
      }
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

  // ===== VALIDATION =====
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
      isValid = questionFilled && subjectFilled && useFilled && hasResponses;
    } else if (currentStatus === "active" || currentStatus === "archive") {
      isValid = questionFilled && subjectFilled && useFilled && hasResponses && hasCorrects;
    }

    this.elements.submitBtn.disabled = !isValid;
  }

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

    this.validateForm();
  }

  // ===== ACTIONS PUBLIQUES =====
  async viewQuestion(id) {
    try {
      this.showMessage("");
      this.currentQuestionId = id;
      const data = await this.fetchQuestion(id);
      this.populateModal(data, "view");
    } catch (error) {
      this.showMessage(`Erreur chargement: ${error.message}`, 'error');
    }
  }

  async editQuestion(id) {
    try {
      this.showMessage("");
      this.currentQuestionId = id;
      const data = await this.fetchQuestion(id);
      this.populateModal(data, "edit");

      // Configuration du bouton submit pour l'édition
      this.setupEditSubmission(data);
    } catch (error) {
      this.showMessage(`Erreur chargement: ${error.message}`, 'error');
    }
  }

  setupEditSubmission(originalData) {
    const submitBtn = this.elements.submitBtn;
    if (!submitBtn) return;

    // Nettoie les anciens handlers
    const newBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newBtn, submitBtn);
    this.elements.submitBtn = newBtn;

    newBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await this.handleEditSubmit();
    });

    // Bouton reset
    const resetBtn = this.elements.resetBtn;
    if (resetBtn) {
      const newReset = resetBtn.cloneNode(true);
      resetBtn.parentNode.replaceChild(newReset, resetBtn);
      this.elements.resetBtn = newReset;

      newReset.addEventListener("click", () => {
        this.populateModal(originalData, "edit");
      });
    }
  }

  async handleEditSubmit() {
    try {
      const payload = this.collectFormData();

      if (!payload.question) {
        this.showMessage("L'intitulé est requis.", 'error');
        return;
      }

      await this.updateQuestion(this.currentQuestionId, payload);
      this.showMessage("Question modifiée avec succès.");

      // Rafraîchir le tableau si disponible
      if (window.tableManager && typeof window.tableManager.refreshTable === 'function') {
        window.tableManager.refreshTable();
      }

    } catch (error) {
      this.showMessage(`Erreur modification: ${error.message}`, 'error');
    }
  }

  async addQuestionToQuiz(id) {
    try {
      const data = await this.fetchQuestion(id);

      // Émet un événement custom pour le module quiz
      const event = new CustomEvent("question:add-to-quiz", {
        detail: { question: data }
      });
      window.dispatchEvent(event);

      this.showMessage(`Question ${id} ajoutée au quizz.`);
    } catch (error) {
      this.showMessage(`Erreur ajout au quizz: ${error.message}`, 'error');
    }
  }

  // ===== BUILD PAYLOAD POUR CRÉATION =====
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

  // ===== CHARGEMENT DES DONNÉES =====
  async loadSelectData() {
    if (!this.config.apiUrl) {
      console.warn("apiUrl non configuré dans APP_CONFIG");
      return;
    }

    try {
      const [subjects, uses] = await Promise.all([
        this.fetchJSON(`${this.config.apiUrl}/subjects`, { authenticated: false }),
        this.fetchJSON(`${this.config.apiUrl}/uses`, { authenticated: false })
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
      console.warn("Impossible de charger subjects/uses:", e);
    }
  }

  // ===== GESTION MODAL =====
  openModal(mode = 'create') {
    this.currentMode = mode;
    if (mode === 'create') {
      this.resetForm();
    }
    this.setModalMode(mode);

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
    this.currentMode = null;
    this.currentQuestionId = null;
  }

  // ===== RESET FORM =====
  resetForm() {
    if (this.elements.questionInput) this.elements.questionInput.value = "";
    if (this.elements.remarkInput) this.elements.remarkInput.value = "";
    if (this.elements.statusSelect) this.elements.statusSelect.value = "draft";

    [this.elements.subjectSelect, this.elements.useSelect].forEach(select => {
      if (select) {
        this.$$("option:checked", select).forEach(o => o.selected = false);
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

  // ===== SOUMISSION POUR CRÉATION =====
  async submitForm(evt) {
    evt.preventDefault();

    const payload = this.buildQuestionPayload();
    const currentStatus = payload.status || "draft";

    // Validation côté client
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

    // Validation des réponses correctes pour statuts actif/archivé
    if (currentStatus === "active" || currentStatus === "archive") {
      if (payload.corrects.length === 0) {
        this.showMessage('Une réponse correcte est obligatoire pour le statut "actif" ou "archivé".', 'error');
        return;
      }

      const correctsNotInResponses = payload.corrects.filter(c => !payload.responses.includes(c));
      if (correctsNotInResponses.length > 0) {
        this.showMessage("Les réponses correctes doivent faire partie des propositions.", 'error');
        return;
      }
    }

    if (!this.config.apiUrl) {
      this.showMessage('Configuration API manquante.', 'error');
      return;
    }

    try {
      this.showMessage('Envoi en cours…');

      const apiUrl = `${this.config.apiUrl}/question`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
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

        // Rafraîchir le tableau si disponible
        if (window.tableManager && typeof window.tableManager.refreshTable === 'function') {
          window.tableManager.refreshTable();
        }

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

    // Debug
    this.showDebug(payload);
  }

  // ===== CONFIGURATION DES ÉVÉNEMENTS =====
  setupEventListeners() {
    // Modal
    if (this.elements.createButton) {
      this.elements.createButton.addEventListener("click", () => this.openModal('create'));
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

    // Délégation d'événements pour les actions du tableau
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id || !action) return;

      if (action === "see_details") this.viewQuestion(id);
      else if (action === "edit_question") this.editQuestion(id);
      else if (action === "add_to_quizz") this.addQuestionToQuiz(id);
    });
  }

  // ===== INITIALISATION =====
  async init() {
    await this.loadSelectData();

    if (this.elements.responsesList && this.elements.responsesList.children.length === 0) {
    this.addResponseRow();
    this.addResponseRow();
  }

    this.setupEventListeners();
    this.validateForm();
    this.updateStatusOptions();
  }
}

let questionManagerInstance = null;

async function see_details(id) {
  if (questionManagerInstance) {
    await questionManagerInstance.viewQuestion(id);
  } else {
    console.error('QuestionManager non initialisé');
  }
}

async function edit_question(id) {
  if (questionManagerInstance) {
    await questionManagerInstance.editQuestion(id);
  } else {
    console.error('QuestionManager non initialisé');
  }
}

async function add_to_quizz(id) {
  if (questionManagerInstance) {
    await questionManagerInstance.addQuestionToQuiz(id);
  } else {
    console.error('QuestionManager non initialisé');
  }
}

// ===== INITIALISATION AUTOMATIQUE =====
document.addEventListener("DOMContentLoaded", () => {
  // Vérifier qu'on est sur la bonne page
  if (document.getElementById("question-detail") || document.getElementById("question-modal")) {
    questionManagerInstance = new QuestionManager();

    // Exposer l'instance globalement pour débogage/intégration
    window.questionManager = questionManagerInstance;
  }
});
