import { SelectManager } from '../question/select-manager'

export class QuestionnaireValidator {
  constructor (elements) {
    this.elements = elements
  }

  validateForm () {
    if (!this.elements.submitBtn) return

    const titleFilled =
      (this.elements.titleInput?.value || '').trim().length > 0
    const subjectFilled =
      SelectManager.collectMultiSelect(this.elements.subjectSelect).length > 0
    const useFilled =
      SelectManager.collectMultiSelect(this.elements.useSelect).length > 0
    const currentStatus = this.elements.statusSelect?.value || 'draft'

    let isValid = false

    // Pour tous les statuts, les champs de base sont requis
    if (currentStatus === 'draft') {
      isValid = titleFilled && subjectFilled && useFilled
    } else if (currentStatus === 'active' || currentStatus === 'archive') {
      // Pour active/archive, on vérifie aussi que la liste questions n'est pas vide
      // (cette info sera vérifiée côté serveur, mais on peut bloquer côté client)
      isValid = titleFilled && subjectFilled && useFilled
    }

    this.elements.submitBtn.disabled = !isValid
  }

  updateStatusOptions () {
    if (!this.elements.statusSelect) return

    // Pour l'instant, on laisse tous les statuts disponibles
    // La validation de la liste de questions se fera côté serveur
    const currentValue = this.elements.statusSelect.value

    const activeOpt = this.elements.statusSelect.querySelector(
      'option[value="active"]'
    )
    const archiveOpt = this.elements.statusSelect.querySelector(
      'option[value="archive"]'
    )

    // On pourrait désactiver active/archive si on connaît l'état de la liste questions
    // Mais pour l'instant on laisse tout enabled
    ;[activeOpt, archiveOpt].forEach(opt => {
      if (opt) opt.disabled = false
    })

    this.validateForm()
  }

  validateSubmissionPayload (payload) {
    const currentStatus = payload.status || 'draft'
    const errors = []

    if (!payload.title) {
      errors.push("Veuillez saisir l'intitulé du questionnaire.")
    }
    if (payload.subjects.length === 0) {
      errors.push('Veuillez renseigner au moins un sujet.')
    }
    if (payload.uses.length === 0) {
      errors.push('Veuillez renseigner au moins un usage.')
    }

    // Règle : draft si liste questions vide
    // La validation complète sera faite côté serveur
    if (
      (currentStatus === 'active' || currentStatus === 'archive') &&
      (!payload.questions || payload.questions.length === 0)
    ) {
      errors.push(
        'Un questionnaire doit contenir au moins une question pour être actif ou archivé.'
      )
    }

    return errors
  }
}
