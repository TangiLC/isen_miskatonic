import { SelectManager } from '../utils/select-manager.js'

export class QuestionnaireFormValidator {
  constructor (elements, responseManager) {
    this.elements = elements
    this.responseManager = responseManager
    this.fieldErrors = new Map()
  }

  // Point d’entrée principal : retourne true si OK, sinon false et affiche les erreurs
  validateForm () {
    if (!this.elements?.submitBtn) return false

    this.clearAll()

    const payload = this._collectPayload()
    const errors = this._computeErrors(payload)

    // Rendu des erreurs champ par champ
    errors.forEach(err => {
      switch (err.field) {
        case 'title':
          this._markError(this.elements.titleInput, err.msg)
          break
        case 'subject':
          this._markError(this.elements.subjectSelect, err.msg)
          break
        case 'use':
          this._markError(this.elements.useSelect, err.msg)
          break
        case 'status':
          this._markError(this.elements.statusSelect, err.msg)
          break
        default:
          // Erreur globale
          this.showSubmitError(err.msg)
      }
    })

    // Ajuste les options de statut selon l’état du formulaire (même logique que l’exemple)
    this.updateStatusOptions()

    return errors.length === 0
  }

  // Désactive/active les options de statut selon la complétude du formulaire
  updateStatusOptions () {
    const statusSelect = this.elements.statusSelect
    if (!statusSelect) return

    const payload = this._collectPayload()
    const hasTitle = payload.title.length > 0
    const hasSubject = payload.subject.length > 0
    const hasUse = payload.use.length > 0

    // Si un compteur de questions est fourni par le responseManager, on l’emploie
    const questionsCount =
      typeof this.responseManager?.getQuestionsCount === 'function'
        ? Number(this.responseManager.getQuestionsCount()) || 0
        : null

    // Conditions minimales pour autoriser active/archive
    const isFormComplete =
      hasTitle &&
      hasSubject &&
      hasUse &&
      (questionsCount === null || questionsCount > 0)

    const currentValue = statusSelect.value || 'draft'
    const activeOpt = statusSelect.querySelector('option[value="active"]')
    const archiveOpt = statusSelect.querySelector('option[value="archive"]')

    ;[activeOpt, archiveOpt].forEach(opt => {
      if (!opt) return
      opt.disabled = !isFormComplete
    })

    // Si incomplet mais statut non autorisé, on force en brouillon
    if (
      !isFormComplete &&
      (currentValue === 'active' || currentValue === 'archive')
    ) {
      statusSelect.value = 'draft'
    }
  }

  // Efface tous les marqueurs d’erreurs
  clearAll () {
    this.fieldErrors.forEach((_, el) => this._unmarkError(el))
    this.fieldErrors.clear()
    this._clearSubmitError()
  }

  // Message d’erreur “global” de soumission (aligné avec l’exemple)
  showSubmitError (msg) {
    // Zone dédiée si présente, sinon fallback sur titleInput
    const target =
      this.elements?.submitErrorBox ||
      this.elements?.modal ||
      this.elements?.titleInput

    if (!target) return

    // On utilise un attribut data pour ne rien imposer au markup
    target.setAttribute('data-submit-error', msg)
    if (target.classList) target.classList.add('has-submit-error')
  }

  // Payload minimal, calqué sur la structure utilisée côté manager/modale
  _collectPayload () {
    const title = (this.elements.titleInput?.value || '').trim()
    const subject = SelectManager.collectMultiSelect(
      this.elements.subjectSelect
    )
    const use = SelectManager.collectMultiSelect(this.elements.useSelect)
    const status = this.elements.statusSelect?.value || 'draft'

    // Support optionnel d’un compteur de questions exposé par responseManager
    const questionsCount =
      typeof this.responseManager?.getQuestionsCount === 'function'
        ? Number(this.responseManager.getQuestionsCount()) || 0
        : null

    return { title, subject, use, status, questionsCount }
  }

  // Règles de validation alignées et messages FR
  _computeErrors (payload) {
    const errors = []

    if (!payload.title) {
      errors.push({ field: 'title', msg: 'Le titre est obligatoire.' })
    }

    if (!Array.isArray(payload.subject) || payload.subject.length === 0) {
      errors.push({ field: 'subject', msg: 'Sélectionne au moins un sujet.' })
    }

    if (!Array.isArray(payload.use) || payload.use.length === 0) {
      errors.push({ field: 'use', msg: 'Sélectionne au moins un usage.' })
    }

    // Statut "active"/"archive" seulement si formulaire complet (et au moins 1 question si disponible)
    const wantsFinalStatus =
      payload.status === 'active' || payload.status === 'archive'
    const hasBasicFields =
      payload.title && payload.subject.length > 0 && payload.use.length > 0
    const hasAtLeastOneQuestion =
      payload.questionsCount === null || payload.questionsCount > 0

    if (wantsFinalStatus && (!hasBasicFields || !hasAtLeastOneQuestion)) {
      errors.push({
        field: 'status',
        msg:
          payload.questionsCount !== null
            ? 'Pour activer ou archiver, ajoute au moins une question et complète les champs requis.'
            : 'Pour activer ou archiver, complète les champs requis.'
      })
    }

    return errors
  }

  // Marquage style “is-invalid”, aria, data-error, etc. sans imposer de CSS
  _markError (el, msg) {
    if (!el) return
    try {
      el.classList?.add('is-invalid')
      el.setAttribute('aria-invalid', 'true')
      el.setAttribute('data-error', msg)
      this.fieldErrors.set(el, msg)

      // Si un data-error-target est fourni, on y reflète le message
      const tgtSel = el.getAttribute('data-error-target')
      if (tgtSel) {
        const tgt = document.querySelector(tgtSel)
        if (tgt) {
          tgt.textContent = msg
          tgt.classList?.add('field-error')
        }
      }
    } catch {
      /* no-op */
    }
  }

  _unmarkError (el) {
    if (!el) return
    try {
      el.classList?.remove('is-invalid')
      el.removeAttribute('aria-invalid')
      el.removeAttribute('data-error')

      const tgtSel = el.getAttribute('data-error-target')
      if (tgtSel) {
        const tgt = document.querySelector(tgtSel)
        if (tgt) {
          tgt.textContent = ''
          tgt.classList?.remove('field-error')
        }
      }
    } catch {
      /* no-op */
    }
  }

  _clearSubmitError () {
    const targets = [
      this.elements?.submitErrorBox,
      this.elements?.modal,
      this.elements?.titleInput
    ].filter(Boolean)

    targets.forEach(t => {
      t.classList?.remove('has-submit-error')
      if (t.hasAttribute?.('data-submit-error'))
        t.removeAttribute('data-submit-error')
    })
  }
}

export default QuestionnaireFormValidator
