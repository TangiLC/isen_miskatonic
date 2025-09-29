// select-manager.js - Gestionnaire des select multiples
import { Utils } from './utils.js';

export class SelectManager {
  static fillSelect(selectEl, values) {
  if (!selectEl) return;

  // Sélectionner selon les valeurs sans ajouter d'options
  Array.from(selectEl.options).forEach(option => {
    option.selected = values.includes(option.value);
  });
  
  // Ajouter uniquement les nouvelles valeurs qui n'existent pas déjà
  const existing = new Set(Array.from(selectEl.options).map(o => o.value));
  values.forEach(value => {
    if (value && !existing.has(value)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = true;
      selectEl.appendChild(option);
    }
  });
}

  static fillSelectViewOnly(selectEl, selectedValues) {
  if (!selectEl) return;

  // Vider complètement le select
  selectEl.innerHTML = '';

  // Ajouter uniquement les valeurs sélectionnées
  selectedValues.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = true;
    selectEl.appendChild(option);
  });
}

  static fillSelectOptions(selectEl, values) {
  if (!selectEl) return;

  // Récupérer les options existantes pour éviter les doublons
  const existing = new Set(Array.from(selectEl.options).map(o => o.value));
  
  values.forEach(v => {
    const val = String(v).trim();
    if (!val || existing.has(val)) return;
    
    existing.add(val); // Ajouter à la liste des existants
    
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    selectEl.appendChild(opt);
  });
}

  static addOptionIfMissing(selectEl, value) {
    if (!selectEl) return;

    const val = String(value || "").trim();
    if (!val) return;

    const exists = Utils.$$("option", selectEl).some(o => o.value === val);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      selectEl.appendChild(opt);
    }

    Utils.$$("option", selectEl).forEach(o => {
      o.selected = (o.value === val);
    });
  }

  static collectMultiSelect(selectEl) {
    if (!selectEl) return [];
    return Utils.$$("option:checked", selectEl).map(o => o.value);
  }
}