// response-manager.js - Gestionnaire des réponses
import { Utils } from './utils.js';

export class ResponseManager {
  constructor(responsesList, validateCallback, updateStatusCallback) {
    this.responsesList = responsesList;
    this.validateCallback = validateCallback;
    this.updateStatusCallback = updateStatusCallback;
    this.currentCorrects = new Set();
  }

  setCurrentCorrects(corrects) {
    this.currentCorrects = new Set(Array.isArray(corrects) ? corrects : []);
  }

  clearResponses() {
    if (this.responsesList) {
      this.responsesList.innerHTML = "";
    }
    if (this.validateCallback) this.validateCallback();
    if (this.updateStatusCallback) this.updateStatusCallback();
  }

  addResponseRow(defaultText = "", isCorrect = false, readonly = false) {
    const template = document.getElementById("response-row-tpl");
    if (!template || !this.responsesList) return;

    const node = template.content.firstElementChild.cloneNode(true);
    const input = Utils.$(".response-input", node);
    const checkbox = Utils.$(".response-correct", node);
    const removeBtn = Utils.$(".remove-response", node);

    const inputValue = defaultText.trim();
    const shouldBeChecked = isCorrect || (inputValue && this.currentCorrects && this.currentCorrects.has(inputValue));

    if (input) input.value = defaultText;
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
          if (this.validateCallback) this.validateCallback();
          if (this.updateStatusCallback) this.updateStatusCallback();
        });
      }
    }

    // Listeners pour la validation
    if (input) {
      input.addEventListener("input", () => {
        if (this.validateCallback) this.validateCallback();
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
        if (this.validateCallback) this.validateCallback();
        if (this.updateStatusCallback) this.updateStatusCallback();

        if (checkbox.checked) {
          node.classList.add("correct");
        } else {
          node.classList.remove("correct");
        }
      });
    }

    this.responsesList.appendChild(node);
    if (this.validateCallback) this.validateCallback();
    if (this.updateStatusCallback) this.updateStatusCallback();
  }

  getResponsesData() {
    const rows = Utils.$$(".response-row", this.responsesList);
    const responses = [];
    const corrects = [];

    rows.forEach(row => {
      const input = Utils.$(".response-input", row);
      const checkbox = Utils.$(".response-correct", row);

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

  populateResponses(responses = [], corrects = [], readonly = false) {
    this.clearResponses();
    this.setCurrentCorrects(corrects);

    responses.forEach(response => {
      const isCorrect = corrects.includes(response);
      this.addResponseRow(response, isCorrect, readonly);
    });

    if (!readonly && responses.length === 0) {
        this.addResponseRow("", false, false);
        this.addResponseRow("", false, false);
        }
  }
}