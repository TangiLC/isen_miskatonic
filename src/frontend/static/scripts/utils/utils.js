// utils.js - Utilitaires de base et helpers
export class Utils {
  // Sélecteurs DOM simplifiés
  static $(sel, root = document) {
    return root.querySelector(sel);
  }

  static $$(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  // Affichage/masquage d'éléments
  static show(el) {
    if (el) el.style.display = "";
  }

  static hide(el) {
    if (el) el.style.display = "none";
  }

  // Formatage de dates
  static formatDateTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    } catch {
      return iso;
    }
  }

  // Gestion des messages
  static showMessage(target, msg, type = 'info') {
  if (!target) return;

  target.textContent = msg;
  target.dataset.type = type;

  target.classList.remove("success", "error");
  if (type === 'error') {
    target.classList.add("error");
  } else if (type === 'success') {
    target.classList.add("success");
  }
}


  // Désactivation/activation des formulaires
  static setFormDisabled(container, disabled) {
    if (!container) return;

    Utils.$$("input, select, textarea, button", container).forEach(el => {
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
}