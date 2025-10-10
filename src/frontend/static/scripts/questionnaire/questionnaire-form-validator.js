import { SelectManager } from '../utils/select-manager.js'

export class QuestionnaireFormValidator {
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

    const isValid = titleFilled && subjectFilled && useFilled

    this.elements.submitBtn.disabled = !isValid
  }

  updateStatusOptions () {
    if (!this.elements.statusSelect) return

    const activeOpt = this.elements.statusSelect.querySelector(
      'option[value="active"]'
    )
    const archiveOpt = this.elements.statusSelect.querySelector(
      'option[value="archive"]'
    )

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

    return errors
  }
}
