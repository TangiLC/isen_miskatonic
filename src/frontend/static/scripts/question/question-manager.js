// question-manager.js - Manager principal refactorisé
import { Utils } from './utils.js';
import { ApiService } from './api-service.js';
import { SelectManager } from './select-manager.js';
import { ResponseManager } from './response-manager.js';
import { FormValidator } from './form-validator.js';
import { ModalManager } from './modal-manager.js';

export class QuestionManager {
  constructor() {
    this.config = window.APP_CONFIG || {};
    this.elements = this.getElements();
    this.currentQuestionId = null;
    
    // Initialisation des services
    this.apiService = new ApiService(this.config);
    
    // Initialisation des managers avec callbacks
    this.responseManager = new ResponseManager(
      this.elements.responsesList,
      () => this.validator.validateForm(),
      () => this.validator.updateStatusOptions()
    );
    
    this.validator = new FormValidator(this.elements, this.responseManager);
    this.modalManager = new ModalManager(this.elements, this.responseManager, this.validator);
    
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

  showMessage(msg, type = 'info') {
    const target = this.elements.feedback || this.elements.resultMessage;
    target.classList.remove("success", "error");
    Utils.showMessage(target, msg, type);
  }

  // ===== ACTIONS PUBLIQUES =====
  async viewQuestion(id) {
    try {
      this.showMessage("");
      this.currentQuestionId = id;
      const data = await this.apiService.fetchQuestion(id);
      this.modalManager.populateModal(data, "view");
    } catch (error) {
      this.showMessage(`Erreur chargement: ${error.message}`, 'error');
    }
  }

  async editQuestion(id) {
    try {
      this.showMessage("");
      this.currentQuestionId = id;
      const data = await this.apiService.fetchQuestion(id);
      this.modalManager.populateModal(data, "edit");
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
        this.modalManager.populateModal(originalData, "edit");
      });
    }
  }

  async handleEditSubmit() {
    try {
      const payload = this.modalManager.collectFormData();

      if (!payload.question) {
        this.showMessage("L'intitulé est requis.", 'error');
        return;
      }

      await this.apiService.updateQuestion(this.currentQuestionId, payload);
      this.modalManager.closeModal();
      this.showMessage(`Question ${this.currentQuestionId} modifiée avec succès.`);
     
      // Rafraîchir le tableau si disponible
      if (window.tableManager && typeof window.tableManager.refreshTable === 'function') {
        window.tableManager.refreshTable();
      }

    } catch (error) {
      this.modalManager.closeModal();
      this.showMessage(`Erreur modification: ${error.message}`, 'error');
    }
  }

  async addQuestionToQuiz(id) {
    try {
      const data = await this.apiService.fetchQuestion(id);

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

  buildQuestionPayload() {
    const { responses, corrects } = this.responseManager.getResponsesData();

    return {
      id: null,
      question: this.elements.questionInput?.value.trim() || "",
      subject: SelectManager.collectMultiSelect(this.elements.subjectSelect),
      use: SelectManager.collectMultiSelect(this.elements.useSelect),
      responses,
      corrects,
      remark: this.elements.remarkInput?.value.trim() || null,
      status: this.elements.statusSelect?.value || "draft",
      created_by: window.APP_CONFIG?.user?.id || null,
      created_at: new Date().toISOString(),
      edited_at: null
    };
  }

  async loadSelectData() {
    try {
      const { subjects, uses } = await this.apiService.loadSelectData();

      SelectManager.fillSelectOptions(this.elements.subjectSelect, subjects);
      SelectManager.fillSelectOptions(this.elements.useSelect, uses);

      console.log("Données chargées:", { subjects, uses });
    } catch (error) {
      console.warn("Erreur chargement données select:", error);
    }
  }

  async submitForm(evt) {
    evt.preventDefault();

    const payload = this.buildQuestionPayload();
    const currentStatus = payload.status || "draft";

    // Validation côté client
    const validationErrors = this.validator.validateSubmissionPayload(payload);
    if (validationErrors.length > 0) {
      this.showMessage(validationErrors[0], 'error');
      return;
    }

    if (!this.config.apiUrl) {
      this.showMessage('Configuration API manquante.', 'error');
      return;
    }

    try {
      this.showMessage('Envoi en cours…');

      const response = await this.apiService.createQuestion(payload);

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

        this.modalManager.resetForm();

        // Rafraîchir le tableau si disponible
        if (window.tableManager && typeof window.tableManager.refreshTable === 'function') {
          window.tableManager.refreshTable();
        }

        setTimeout(() => this.modalManager.closeModal(), 2000);
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
    this.modalManager.showDebug(payload);
  }

  setupEventListeners() {
    // Modal
    if (this.elements.createButton) {
      this.elements.createButton.addEventListener("click", () => this.modalManager.openModal('create'));
    }

    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener("click", () => this.modalManager.closeModal());
    }

    if (this.elements.modal) {
      this.elements.modal.addEventListener("click", (e) => {
        if (e.target === this.elements.modal) this.modalManager.closeModal();
      });
    }

    // Échap pour fermer le modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.elements.modal?.style.display !== "none") {
        this.modalManager.closeModal();
      }
    });

    // Ajout d'options
    if (this.elements.subjectAddBtn) {
      this.elements.subjectAddBtn.addEventListener("click", () => {
        SelectManager.addOptionIfMissing(this.elements.subjectSelect, this.elements.subjectAdd?.value);
        if (this.elements.subjectAdd) this.elements.subjectAdd.value = "";
        this.validator.validateForm();
      });
    }

    if (this.elements.useAddBtn) {
      this.elements.useAddBtn.addEventListener("click", () => {
        SelectManager.addOptionIfMissing(this.elements.useSelect, this.elements.useAdd?.value);
        if (this.elements.useAdd) this.elements.useAdd.value = "";
        this.validator.validateForm();
      });
    }

    // Ajout de réponse
    if (this.elements.addResponseBtn) {
      this.elements.addResponseBtn.addEventListener("click", () => this.responseManager.addResponseRow());
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
      this.elements.resetBtn.addEventListener("click", () => this.modalManager.resetForm());
    }

    // Validation en temps réel
    [this.elements.questionInput, this.elements.remarkInput].forEach(input => {
      if (input) {
        input.addEventListener("input", () => this.validator.validateForm());
      }
    });

    [this.elements.subjectSelect, this.elements.useSelect, this.elements.statusSelect].forEach(select => {
      if (select) {
        select.addEventListener("change", () => this.validator.validateForm());
      }
    });

    // Observer pour les changements dans la liste des réponses
    if (this.elements.responsesList && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        this.validator.validateForm();
        this.validator.updateStatusOptions();
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

  async init() {
    await this.loadSelectData();

    if (this.elements.responsesList && this.elements.responsesList.children.length === 0) {
      this.responseManager.addResponseRow();
      this.responseManager.addResponseRow();
    }

    this.setupEventListeners();
    this.validator.validateForm();
    this.validator.updateStatusOptions();
  }
}

// Fonctions globales pour la compatibilité
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

// Initialisation automatique
document.addEventListener("DOMContentLoaded", () => {
  // Vérifier qu'on est sur la bonne page
  if (document.getElementById("question-detail") || document.getElementById("question-modal")) {
    questionManagerInstance = new QuestionManager();

    // Exposer l'instance globalement pour débogage/intégration
    window.questionManager = questionManagerInstance;
  }
});