import { Utils } from '../utils/utils.js'
import { SelectManager } from '../utils/select-manager.js'

export class QuestionModalManager {
  constructor (elements, responseManager, validator) {
    this.elements = elements
    this.responseManager = responseManager
    this.validator = validator
    this.currentMode = null
  }

  setModalMode (mode, data = {}) {
    this.currentMode = mode

    // Mise à jour du titre
    if (this.elements.modalTitle) {
      const titles = {
        view: `Détail de la question ${data.id || ''}`,
        edit: `Modification de la question ${data.id || ''}`,
        create: "Création d'une nouvelle question"
      }
      this.elements.modalTitle.textContent = titles[mode] || titles.create
    }

    // Gestion des boutons
    const isReadonly = mode === 'view'

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
      if (isReadonly) {
        Utils.hide(this.elements.resetBtn)
      } else {
        Utils.show(this.elements.resetBtn)
      }
    }

    // Bouton d'ajout de réponse
    if (this.elements.addResponseBtn) {
      if (isReadonly) {
        this.elements.addResponseBtn.disabled = true
        this.elements.addResponseBtn.style.visibility = 'hidden'
      } else {
        this.elements.addResponseBtn.disabled = false
        this.elements.addResponseBtn.style.visibility = 'visible'
      }
    }

    // Masquer les div q-adder en mode view
    const adderDivs = Utils.$$('.q-adder')
    adderDivs.forEach(div => {
      if (isReadonly) {
        Utils.hide(div)
      } else {
        Utils.show(div)
      }
    })

    // Verrouillage du formulaire
    Utils.setFormDisabled(this.elements.modal, isReadonly)
  }

  populateModal (data, mode = 'view') {
    // Champs de base
    if (this.elements.questionInput)
      this.elements.questionInput.value = data.question || ''
    if (this.elements.remarkInput)
      this.elements.remarkInput.value = data.remark || ''

    // Informations
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
        // create ou edit
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

    /* Subjects et Uses
    if (mode === 'view') {
      SelectManager.fillSelectViewOnly(
        this.elements.subjectSelect,
        Array.isArray(data.subjects) ? [...new Set(data.subjects)] : []
      )
      SelectManager.fillSelectViewOnly(
        this.elements.useSelect,
        Array.isArray(data.uses) ? [...new Set(data.uses)] : []
      )
    } else {
      SelectManager.fillSelect(
        this.elements.subjectSelect,
        Array.isArray(data.subjects) ? [...new Set(data.subjects)] : []
      )
      SelectManager.fillSelect(
        this.elements.useSelect,
        Array.isArray(data.uses) ? [...new Set(data.uses)] : []
      )
    }*/
    // Subjects et Uses
    const subjects = Array.isArray(data.subjects)
      ? [...new Set(data.subjects)]
      : []
    const uses = Array.isArray(data.uses) ? [...new Set(data.uses)] : []

    if (mode === 'view') {
      SelectManager.fillSelectViewOnly(this.elements.subjectSelect, subjects)
      SelectManager.fillSelectViewOnly(this.elements.useSelect, uses)
    } else {
      // En mode CREATE/EDIT, les options sont déjà chargées via loadSelectData()
      // On sélectionne simplement les bonnes valeurs
      SelectManager.fillSelect(this.elements.subjectSelect, subjects)
      SelectManager.fillSelect(this.elements.useSelect, uses)
    }

    const responses = Array.isArray(data.responses) ? data.responses : []
    const corrects = Array.isArray(data.corrects) ? data.corrects : []
    this.responseManager.populateResponses(responses, corrects, mode === 'view')

    if (this.elements.statusSelect) {
      const status = data.status || 'draft'
      this.elements.statusSelect.value = status
    }

    // Configuration du mode
    this.setModalMode(mode, data)
    Utils.show(this.elements.modal)

    setTimeout(() => {
      this.validator.updateStatusOptions()
      this.validator.validateForm()
    }, 0)
  }

  openModal (mode = 'create') {
    this.currentMode = mode
    if (mode === 'create') {
      this.resetForm()
    }
    this.setModalMode(mode)

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

  resetForm () {
    if (this.elements.questionInput) this.elements.questionInput.value = ''
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

    const { responses, corrects } = this.responseManager.getResponsesData()

    return { question, subject, use, remark, status, responses, corrects }
  }

  showDebug (payload) {
    if (this.elements.debugOutput) {
      this.elements.debugOutput.textContent = JSON.stringify(payload, null, 2)
    }
  }
}

export default QuestionModalManager
