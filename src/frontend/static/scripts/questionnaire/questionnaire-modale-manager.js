import { Utils } from '../utils/utils.js'
import { SelectManager } from '../utils/select-manager.js'
import { QuestionnaireTableUtils } from './questionnaire-table-utils.js'

export class QuestionnaireModalManager {
  constructor (elements, responseManager, validator) {
    this.elements = elements
    this.responseManager = responseManager
    this.validator = validator
    this.currentMode = null
    this.modalQuestions = []
    this.onRandomAdd = null

    this.elements.modalQuestionsContainer = document.getElementById(
      'qr-modal-questions-container'
    )
    this.elements.modalQuestionsTable =
      document.getElementById('qr-modal-qTable')
    this.elements.modalQuestionsTbody =
      this.elements.modalQuestionsTable?.querySelector('tbody')
    this.elements.randomSection = document.getElementById('qr-random-section')
    this.elements.randomNumber = document.getElementById('qr-random-number')
    this.elements.randomSubjects = document.getElementById('qr-random-subjects')
    this.elements.randomAddBtn = document.getElementById('qr-random-add-btn')
    this.bindBaseEvents()
  }

  setModalMode (mode, data = {}) {
    this.currentMode = mode
    if (this.elements.modalTitle) {
      const titles = {
        view: `Détail du questionnaire ${data.id || ''}`,
        edit: `Modification du questionnaire ${data.id || ''}`,
        create: "Création d'un nouveau questionnaire"
      }
      this.elements.modalTitle.textContent = titles[mode] || titles.create
    }

    const isReadonly = mode === 'view'

    if (this.elements.submitBtn) {
      if (isReadonly) {
        Utils.hide(this.elements.submitBtn)
      } else {
        Utils.show(this.elements.submitBtn)
        this.elements.submitBtn.innerText =
          mode === 'edit' ? `Enregistrer les modifications` : 'Enregistrer'
      }
    }

    if (this.elements.resetBtn) {
      if (isReadonly) {
        Utils.hide(this.elements.resetBtn)
      } else {
        Utils.show(this.elements.resetBtn)
      }
    }

    if (this.elements.addResponseBtn) {
      if (isReadonly) {
        this.elements.addResponseBtn.disabled = true
        this.elements.addResponseBtn.style.visibility = 'hidden'
      } else {
        this.elements.addResponseBtn.disabled = false
        this.elements.addResponseBtn.style.visibility = 'visible'
      }
    }

    const adderDivs = Utils.$$('.q-adder')
    adderDivs.forEach(div => {
      if (isReadonly) {
        Utils.hide(div)
      } else {
        Utils.show(div)
      }
    })

    if (this.elements.modalQuestionsContainer) {
      if (mode === 'create') {
        this.elements.modalQuestionsContainer.style.display = 'none'
      } else {
        this.elements.modalQuestionsContainer.style.display = 'block'
      }
    }

    if (this.elements.randomSection) {
      if (mode === 'edit') {
        this.elements.randomSection.style.display = 'block'

        // En mode create, désactiver jusqu'à création
        if (this.elements.randomAddBtn) {
          this.elements.randomAddBtn.disabled = mode === 'create'
        }
      } else {
        this.elements.randomSection.style.display = 'none'
      }
    }

    Utils.setFormDisabled(this.elements.modal, isReadonly)
  }

  populateModal (data, mode = 'view') {
    if (data.id) {
      this.currentQuestionnaireId = data.id
    }
    if (this.elements.titleInput)
      this.elements.titleInput.value = data.title || ''
    if (this.elements.remarkInput)
      this.elements.remarkInput.value = data.remark || ''

    if (this.elements.infoSections && this.elements.infoSections.length >= 3) {
      if (mode === 'view') {
        const createdById = data.created_by || null
        if (createdById) {
          fetch(`/api/users/${createdById}/name`)
            .then(response => response.json())
            .then(result => {
              this.elements.infoSections[0].innerHTML = `Créé par : ${
                result.userName || 'Inconnu'
              }`
            })
            .catch(() => {
              this.elements.infoSections[0].innerHTML = `Créé par : Inconnu`
            })
        } else {
          this.elements.infoSections[0].innerHTML = `Créé par : Inconnu`
        }
        this.elements.infoSections[1].innerHTML = `Créé le : ${Utils.formatDateTime(
          data.created_at
        )}`
        this.elements.infoSections[2].innerHTML = `Modifié le : ${
          data.edited_at ? Utils.formatDateTime(data.edited_at) : '-'
        }`
      } else {
        const currentUser = window.APP_CONFIG?.user?.id || 'Vous'
        let createdAt =
          mode === 'create' ? new Date().toISOString() : data.created_at
        this.elements.infoSections[0].innerHTML = `Créé par : ${currentUser}`
        this.elements.infoSections[1].innerHTML = `Créé le : ${Utils.formatDateTime(
          createdAt
        )}`
        this.elements.infoSections[2].innerHTML = `Modifié le : ${
          data.edited_at ? Utils.formatDateTime(data.edited_at) : '-'
        }`
      }
    }

    const subjects = Array.isArray(data.subjects)
      ? [...new Set(data.subjects)]
      : []
    const uses = Array.isArray(data.uses) ? [...new Set(data.uses)] : []

    if (mode === 'view') {
      SelectManager.fillSelectViewOnly(this.elements.subjectSelect, subjects)
      SelectManager.fillSelectViewOnly(this.elements.useSelect, uses)
    } else {
      SelectManager.fillSelect(this.elements.subjectSelect, subjects)
      SelectManager.fillSelect(this.elements.useSelect, uses)
    }

    this.modalQuestions = Array.isArray(data.questions)
      ? [...data.questions]
      : []
    this.renderModalQuestionsTable(mode)

    const questions = Array.isArray(data.questions) ? data.questions : []
    if (this.responseManager && this.responseManager.populateQuestions) {
      this.responseManager.populateQuestions(questions, mode === 'view')
    }

    if (this.elements.statusSelect) {
      const status = data.status || 'draft'
      this.elements.statusSelect.value = status
    }

    if (this.elements.randomSubjects && mode == 'edit') {
      this.elements.randomSubjects.innerHTML =
        this.elements.subjectSelect.innerHTML

      const currentSubjects = Array.isArray(subjects) ? subjects : []
      Array.from(this.elements.randomSubjects.options).forEach(option => {
        option.selected = currentSubjects.includes(option.value)
      })
    }

    this.setModalMode(mode, data)
    Utils.show(this.elements.modal)

    setTimeout(() => {
      this.validator.updateStatusOptions()
      this.validator.validateForm()
    }, 0)
  }

  renderModalQuestionsTable (mode) {
    if (!this.elements.modalQuestionsTbody) return

    const isReadonly = mode === 'view'

    QuestionnaireTableUtils.renderQuestionsTable(
      this.elements.modalQuestionsTbody,
      this.modalQuestions,
      {
        isReadonly,
        callbacks: {
          onMove: (index, direction) =>
            this.moveModalQuestion(index, direction),
          onRemove: (index, text) => this.removeModalQuestion(index, text)
        }
      }
    )
  }

  moveModalQuestion (fromIndex, direction) {
    const result = QuestionnaireTableUtils.moveQuestion(
      this.modalQuestions,
      fromIndex,
      direction
    )

    if (!result) return

    this.renderModalQuestionsTable(this.currentMode)
  }

  removeModalQuestion (index, questionText) {
    const result = QuestionnaireTableUtils.removeQuestion(
      this.modalQuestions,
      index,
      questionText
    )

    if (!result) return

    this.renderModalQuestionsTable(this.currentMode)
  }

  async handleRandomAdd () {
    const number = parseInt(this.elements.randomNumber?.value || '0')
    const subjects = SelectManager.collectMultiSelect(
      this.elements.randomSubjects
    )

    if (number < 1) {
      alert('Veuillez saisir un nombre valide de questions')
      return
    }

    if (subjects.length === 0) {
      alert('Veuillez sélectionner au moins un sujet')
      return
    }

    if (!this.currentQuestionnaireId) {
      alert('Erreur: ID du questionnaire manquant')
      return
    }
    if (this.elements.randomAddBtn) {
      this.elements.randomAddBtn.disabled = true
    }

    try {
      if (this.onRandomAdd) {
        await this.onRandomAdd(this.currentQuestionnaireId, {
          number,
          subjects
        })
      }
    } finally {
      if (this.elements.randomAddBtn) {
        this.elements.randomAddBtn.disabled = false
      }
    }
  }

  openModal (mode, data) {
    this.currentMode = mode
    if (mode === 'create') {
      this.resetForm()
      this.setModalMode(mode, {})
    } else if (mode == 'view' || mode == 'edit') {
      this.setModalMode(mode, data)
      if (!data) {
        console.error('Données manquantes pour le mode', mode)
        return
      }
      this.populateModal(data, mode)
    } else {
      console.error('Mode invalide:', mode)
      return
    }

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
    this.modalQuestions = []
  }

  resetForm () {
    if (this.elements.titleInput) this.elements.titleInput.value = ''
    if (this.elements.remarkInput) this.elements.remarkInput.value = ''
    if (this.elements.statusSelect) this.elements.statusSelect.value = 'draft'
    if (this.elements.randomNumber) this.elements.randomNumber.value = '5'
    if (this.elements.randomSubjects)
      SelectManager.clearSelection(this.elements.randomSubjects)
    if (this.elements.randomAddBtn) this.elements.randomAddBtn.disabled = true
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

    if (this.responseManager && this.responseManager.clearResponses) {
      this.responseManager.clearResponses()
    }
    if (this.responseManager && this.responseManager.addResponseRow) {
      this.responseManager.addResponseRow()
      this.responseManager.addResponseRow()
    }

    this.modalQuestions = []

    if (this.validator) {
      this.validator.validateForm()
      this.validator.updateStatusOptions()
    }
  }

  bindBaseEvents () {
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener('click', e => {
        e.preventDefault()
        this.closeModal()
      })
    }

    if (this.elements.resetBtn && this.elements.form) {
      this.elements.resetBtn.addEventListener('click', e => {
        e.preventDefault()
        this.resetForm()
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
            this.closeModal()
          } catch (err) {
            console.error('submitQuestionnaire error', err)
            if (this.validator?.showSubmitError) {
              this.validator.showSubmitError(
                "Une erreur est survenue lors de l'enregistrement."
              )
            }
          }
        }
      })
    }
    if (this.elements.randomAddBtn) {
      this.elements.randomAddBtn.addEventListener('click', async () => {
        await this.handleRandomAdd()
      })
    }
  }

  collectFormData () {
    const title = this.elements.titleInput?.value.trim() || ''
    const remark = this.elements.remarkInput?.value.trim() || ''
    const status = this.elements.statusSelect?.value || 'draft'

    const subjects = SelectManager.collectMultiSelect(
      this.elements.subjectSelect
    )
    const uses = SelectManager.collectMultiSelect(this.elements.useSelect)

    let questions = []
    if (this.currentMode === 'edit' || this.currentMode === 'view') {
      questions = this.modalQuestions.map(q => ({
        id: q.id,
        question: q.question
      }))
    } else if (this.responseManager && this.responseManager.getQuestionsData) {
      questions = this.responseManager.getQuestionsData()
    }

    const payload = { title, subjects, uses, remark, status, questions }
    if (this.currentMode === 'edit' && this.currentQuestionnaireId) {
      payload.id = this.currentQuestionnaireId
    }
    return payload
  }

  showDebug (payload) {
    if (this.elements.debugOutput) {
      this.elements.debugOutput.textContent = JSON.stringify(payload, null, 2)
    }
  }
}

export default QuestionnaireModalManager
