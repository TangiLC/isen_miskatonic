import { SelectManager } from '../utils/select-manager.js'

class BaseFormValidator {
  constructor (elements) {
    this.elements = elements
  }

  isTextFieldFilled (input) {
    return (input?.value || '').trim().length > 0
  }

  isMultiSelectFilled (select) {
    return SelectManager.collectMultiSelect(select).length > 0
  }

  toggleStatusOptions (shouldEnable) {
    if (!this.elements.statusSelect) return

    const activeOpt = this.elements.statusSelect.querySelector(
      'option[value="active"]'
    )
    const archiveOpt = this.elements.statusSelect.querySelector(
      'option[value="archive"]'
    )

    ;[activeOpt, archiveOpt].forEach(opt => {
      if (opt) opt.disabled = !shouldEnable
    })
  }

  validateForm () {
    throw new Error('validateForm() doit être implémentée')
  }

  validateSubmissionPayload (payload) {
    throw new Error('validateSubmissionPayload() doit être implémentée')
  }
}

export class QuestionnaireFormValidator extends BaseFormValidator {
  validateForm () {
    if (!this.elements.submitBtn) return

    const titleFilled = this.isTextFieldFilled(this.elements.titleInput)
    const subjectFilled = this.isMultiSelectFilled(this.elements.subjectSelect)
    const useFilled = this.isMultiSelectFilled(this.elements.useSelect)

    const isValid = titleFilled && subjectFilled && useFilled

    this.elements.submitBtn.disabled = !isValid
  }

  updateStatusOptions () {
    this.toggleStatusOptions(true)
    this.validateForm()
  }

  validateSubmissionPayload (payload) {
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

export class QuestionFormValidator extends BaseFormValidator {
  constructor (elements, responseManager) {
    super(elements)
    this.responseManager = responseManager
  }

  validateForm () {
    if (!this.elements.submitBtn) return

    const questionFilled = this.isTextFieldFilled(this.elements.questionInput)
    const subjectFilled = this.isMultiSelectFilled(this.elements.subjectSelect)
    const useFilled = this.isMultiSelectFilled(this.elements.useSelect)

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

    const { corrects, responses } = this.responseManager.getResponsesData()
    const hasCorrect = corrects.length > 0
    const currentValue = this.elements.statusSelect.value

    this.toggleStatusOptions(hasCorrect)

    // Statut bloqué sur draft tant que aucune réponse correcte prévue
    if (
      !hasCorrect &&
      (currentValue === 'active' || currentValue === 'archive')
    ) {
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
