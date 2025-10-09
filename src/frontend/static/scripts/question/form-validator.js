// form-validator.js - Validateur de formulaire
import { SelectManager } from '../utils/select-manager.js'

export class FormValidator {
  constructor (elements, responseManager) {
    this.elements = elements
    this.responseManager = responseManager
  }

  validateForm () {
    if (!this.elements.submitBtn) return

    const questionFilled =
      (this.elements.questionInput?.value || '').trim().length > 0
    const subjectFilled =
      SelectManager.collectMultiSelect(this.elements.subjectSelect).length > 0
    const useFilled =
      SelectManager.collectMultiSelect(this.elements.useSelect).length > 0
    const { responses, corrects } = this.responseManager.getResponsesData()
    const hasResponses = responses.length > 0
    const hasCorrects = corrects.length > 0
    const currentStatus = this.elements.statusSelect?.value || 'draft'

    let isValid = false

    if (currentStatus === 'draft') {
      isValid = questionFilled && subjectFilled && useFilled && hasResponses
    } else if (currentStatus === 'active' || currentStatus === 'archive') {
      isValid =
        questionFilled &&
        subjectFilled &&
        useFilled &&
        hasResponses &&
        hasCorrects
    }

    this.elements.submitBtn.disabled = !isValid
  }

  updateStatusOptions () {
    if (!this.elements.statusSelect) return

    const { corrects } = this.responseManager.getResponsesData()
    const hasCorrect = corrects.length > 0
    const currentValue = this.elements.statusSelect.value

    const activeOpt = this.elements.statusSelect.querySelector(
      'option[value="active"]'
    )
    const archiveOpt = this.elements.statusSelect.querySelector(
      'option[value="archive"]'
    )

    ;[activeOpt, archiveOpt].forEach(opt => {
      if (!opt) return
      opt.disabled = !hasCorrect
    })

    // Statut bloqué sur draft tant que aucune réponse correcte prévue
    if (
      !hasCorrect &&
      (currentValue === 'active' || currentValue === 'archive')
    ) {
      const { responses } = this.responseManager.getResponsesData()
      if (responses.length === 0) {
        this.elements.statusSelect.value = 'draft'
      }
    }

    this.validateForm()
  }

  validateSubmissionPayload (payload) {
    const currentStatus = payload.status || 'draft'
    const errors = []

    if (!payload.question) {
      errors.push("Veuillez saisir l'intitulé de la question.")
    }
    if (payload.subject.length === 0) {
      errors.push('Veuillez renseigner au moins un sujet.')
    }
    if (payload.use.length === 0) {
      errors.push('Veuillez renseigner au moins un usage.')
    }
    if (payload.responses.length === 0) {
      errors.push('Veuillez fournir au moins une proposition de réponse.')
    }

    if (currentStatus === 'active' || currentStatus === 'archive') {
      if (payload.corrects.length === 0) {
        errors.push(
          'Une réponse correcte est obligatoire pour le statut "actif" ou "archivé".'
        )
      }

      const correctsNotInResponses = payload.corrects.filter(
        c => !payload.responses.includes(c)
      )
      if (correctsNotInResponses.length > 0) {
        errors.push(
          'Les réponses correctes doivent faire partie des propositions.'
        )
      }
    }

    return errors
  }
}
