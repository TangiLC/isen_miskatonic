import { Utils } from '../utils/utils.js'
import { SelectManager } from '../utils/select-manager.js'

export class QuestionnaireModalManager {
  constructor (elements, responseManager, validator) {
    this.elements = elements || {}
    this.responseManager = responseManager
    this.validator = validator
    this.currentMode = null
  }

  openModal (mode = 'create') {
    this.currentMode = mode
    if (mode === 'create') {
      this.resetForm()
    }
    this.setModalMode(mode)
    console.log('OPEN')

    if (this.elements.modal) {
      this.elements.modal.style.display = ''
      setTimeout(() => {
        this.validator.validateForm()
      }, 0)
    }
  }

  closeModal () {
    if (this.elements.modal) {
      this.elements.modal.style.display = 'none'
    }
    this.currentMode = null
  }

  /**
   * Modes : 'create' | 'edit' | 'view'
   * data : { id?, title?, remark?, status?, subject?, use?, created_by?, created_at?, edited_at? }
   */
  setModalMode (mode, data = {}) {
    this.currentMode = mode

    // Titre
    if (this.elements.modalTitle) {
      const titles = {
        view: `Détail du questionnaire ${data.id || ''}`,
        edit: `Modification du questionnaire ${data.id || ''}`,
        create: "Création d'un nouveau questionnaire"
      }
      const title = titles[mode] || 'Questionnaire'
      this.elements.modalTitle.textContent = title
    }

    const isReadonly = mode === 'view'
    const toggleRO = el => {
      if (!el) return
      el.disabled = isReadonly
      if (isReadonly) el.setAttribute('readonly', 'readonly')
      else el.removeAttribute('readonly')
    }

    toggleRO(this.elements.titleInput)
    toggleRO(this.elements.remarkInput)
    if (this.elements.statusSelect)
      this.elements.statusSelect.disabled = isReadonly
    if (this.elements.subjectSelect)
      this.elements.subjectSelect.disabled = isReadonly
    if (this.elements.useSelect) this.elements.useSelect.disabled = isReadonly

    if (this.elements.submitBtn) {
      if (isReadonly) {
        Utils.hide(this.elements.submitBtn)
      } else {
        Utils.show(this.elements.submitBtn)
        this.elements.submitBtn.textContent =
          mode === 'edit' ? 'Modifier' : 'Enregistrer'
      }
    }
    if (this.elements.resetBtn) {
      if (isReadonly) Utils.hide(this.elements.resetBtn)
      else Utils.show(this.elements.resetBtn)
    }

    if (
      Array.isArray(this.elements.infoSections) &&
      this.elements.infoSections.length >= 3
    ) {
      if (mode === 'view') {
        const author = data.created_by ?? '-'
        const createdAt = data.created_at
          ? Utils.formatDateTime(data.created_at)
          : '-'
        const editedAt = data.edited_at
          ? Utils.formatDateTime(data.edited_at)
          : '-'
        this.elements.infoSections[0].innerHTML = `Créé par : ${author}`
        this.elements.infoSections[1].innerHTML = `Créé le : ${createdAt}`
        this.elements.infoSections[2].innerHTML = `Modifié le : ${editedAt}`
      } else {
        const currentUser = window.APP_CONFIG?.user?.id || 'Vous'
        const createdAt =
          mode === 'create'
            ? new Date().toISOString()
            : data.created_at || new Date().toISOString()
        const editedAt = mode === 'edit' ? new Date().toISOString() : null
        this.elements.infoSections[0].innerHTML = `Créé par : ${currentUser}`
        this.elements.infoSections[1].innerHTML = `Créé le : ${Utils.formatDateTime(
          createdAt
        )}`
        this.elements.infoSections[2].innerHTML = `Modifié le : ${
          editedAt ? Utils.formatDateTime(editedAt) : '-'
        }`
      }
    }

    if (isReadonly) {
      if (this.elements.subjectSelect) {
        SelectManager.fillSelectViewOnly(
          this.elements.subjectSelect,
          Array.isArray(data.subject) ? [...new Set(data.subject)] : []
        )
      }
      if (this.elements.useSelect) {
        SelectManager.fillSelectViewOnly(
          this.elements.useSelect,
          Array.isArray(data.use) ? [...new Set(data.use)] : []
        )
      }
    } else {
      if (this.elements.subjectSelect) {
        SelectManager.fillSelect(
          this.elements.subjectSelect,
          data.subject || []
        )
      }
      if (this.elements.useSelect) {
        SelectManager.fillSelect(this.elements.useSelect, data.use || [])
      }
    }

    if (this.elements.titleInput)
      this.elements.titleInput.value = (data.title || '').trim()
    if (this.elements.remarkInput)
      this.elements.remarkInput.value = (data.remark || '').trim()
    if (this.elements.statusSelect)
      this.elements.statusSelect.value = data.status || 'draft'

    if (this.validator?.clearAll) this.validator.clearAll()
  }

  bindBaseEvents () {
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener('click', e => {
        e.preventDefault()
      })
    }

    if (this.elements.resetBtn && this.elements.form) {
      this.elements.resetBtn.addEventListener('click', e => {
        e.preventDefault()
        this.elements.form.reset()
        if (this.validator?.clearAll) this.validator.clearAll()
        ;[this.elements.subjectSelect, this.elements.useSelect].forEach(
          select => {
            if (select) {
              Utils.$$('option:checked', select).forEach(
                o => (o.selected = false)
              )
            }
          }
        )
      })
    }

    if (this.elements.form) {
      this.elements.form.addEventListener('submit', async e => {
        e.preventDefault()
        if (
          this.validator &&
          !this.validator.validateForm(this.elements.form)
        ) {
          return
        }
        const payload = this.collectFormData()

        if (this.responseManager?.submitQuestionnaire) {
          try {
            await this.responseManager.submitQuestionnaire(payload, {
              mode: this.currentMode
            })
            this.close()
          } catch (err) {
            console.error('submitQuestionnaire error', err)
            if (this.validator?.showSubmitError) {
              this.validator.showSubmitError(
                'Une erreur est survenue lors de l’enregistrement.'
              )
            }
          }
        }
      })
    }
  }

  resetForm () {
    if (this.elements.titleInput) this.elements.titleInput.value = ''
    if (this.elements.remarkInput) this.elements.remarkInput.value = ''
    if (this.elements.statusSelect) this.elements.statusSelect.value = 'draft'
    if (this.elements.infoSections && this.elements.infoSections[1]) {
      this.elements.infoSections[1].innerHTML = `Créé le : ${Utils.formatDateTime(
        new Date().toISOString()
      )}`
    }

    ;[this.elements.subjectSelect, this.elements.useSelect].forEach(select => {
      if (select) {
        Utils.$$('option:checked', select).forEach(o => (o.selected = false))
      }
    })

    this.responseManager.clearResponses()
    this.responseManager.addResponseRow()
    this.responseManager.addResponseRow()

    this.validator.validateForm()
    this.validator.updateStatusOptions()
  }

  collectFormData () {
    const question = this.elements.questionInput?.value.trim() || ''
    const remark = this.elements.remarkInput?.value.trim() || ''
    const status = this.elements.statusSelect?.value || 'draft'

    const subject = SelectManager.collectMultiSelect(
      this.elements.subjectSelect
    )
    const use = SelectManager.collectMultiSelect(this.elements.useSelect)

    return { question, subject, use, remark, status }
  }

  showDebug (payload) {
    if (this.elements.debugOutput) {
      this.elements.debugOutput.textContent = JSON.stringify(payload, null, 2)
    }
  }
}

export default QuestionnaireModalManager
