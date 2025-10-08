class QuizManager {
  constructor () {
    this.config = window.APP_CONFIG || {}
    this.questionnaireId = null
    this.questions = []
    this.elements = this.getElements()
    this.init()
  }

  getElements () {
    return {
      container: document.getElementById('quiz-container'),
      submitBtn: document.getElementById('submit'),
      result: document.getElementById('result')
    }
  }

  init () {
    // Récupérer l'ID du questionnaire
    this.questionnaireId =
      sessionStorage.getItem('current_questionnaire_id') ||
      this.config.questionnaireId

    if (!this.isValidQuestionnaireId(this.questionnaireId)) {
      this.showError(
        'Aucun questionnaire sélectionné. Veuillez saisir un identifiant.'
      )
      return
    }

    // Charger le quiz
    this.loadQuiz()
  }

  isValidQuestionnaireId (id) {
    return id && id !== 'None' && id !== 'null' && id !== ''
  }

  showError (message) {
    if (this.elements.container) {
      this.elements.container.innerHTML = `
        <div style="padding: 1rem; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px;">
          ${message}
        </div>
      `
    }
  }

  async loadQuiz () {
    // Vérifier le token
    if (!this.config.token) {
      alert("Token d'authentification manquant !")
      return
    }

    try {
      // Appel API pour récupérer le questionnaire complet
      const response = await fetch(
        `${this.config.apiUrl}/questionnaire/${this.questionnaireId}/full`,
        {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            Accept: 'application/json'
          }
        }
      )

      if (!response.ok) {
        this.handleError(response.status)
        return
      }

      const questionnaire = await response.json()
      this.questions = questionnaire.questions || []
      this.renderQuestionnaireInfo(questionnaire.title, questionnaire.remark)

      if (this.questions.length === 0) {
        this.showError('Ce questionnaire ne contient aucune question.')
        return
      }

      // Afficher les questions
      this.renderQuestions()

      // Configurer le bouton de validation
      this.setupSubmitButton()
    } catch (error) {
      console.error('Erreur lors du chargement du quiz:', error)
      alert('Erreur lors du chargement des questions !')
    }
  }

  handleError (status) {
    switch (status) {
      case 404:
        alert('Questionnaire introuvable !')
        break
      case 401:
        alert('Non autorisé. Veuillez vous reconnecter.')
        break
      default:
        alert(`Erreur lors du chargement du questionnaire (${status})`)
    }
  }

  renderQuestionnaireInfo (title, remark) {
    const titleElement = document.getElementById('QRTitle')
    const remarkElement = document.getElementById('QRRemark')

    if (titleElement && title) {
      titleElement.textContent = title
    } else titleElement.textContent = 'Questionnaire'

    if (remarkElement && remark) {
      remarkElement.textContent = remark
    }
  }

  renderQuestions () {
    if (!this.elements.container) return

    this.elements.container.innerHTML = ''

    this.questions.forEach((q, index) => {
      const div = document.createElement('div')
      div.classList.add('question')

      const title = document.createElement('h3')
      title.textContent = `${index + 1}. ${q.question}`
      div.appendChild(title)

      const optionsDiv = document.createElement('div')
      optionsDiv.classList.add('options')

      const responses = q.responses || []
      responses.forEach(opt => {
        const label = document.createElement('label')
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.name = `question-${index}`
        input.value = opt
        label.appendChild(input)
        label.appendChild(document.createTextNode(opt))
        optionsDiv.appendChild(label)
      })

      div.appendChild(optionsDiv)

      const remarkDiv = document.createElement('div')
      remarkDiv.classList.add('nodisplay', 'remark')
      remarkDiv.textContent = q.remark ? q.remark : 'Pas de remarque'
      div.appendChild(remarkDiv)

      this.elements.container.appendChild(div)
    })
  }

  setupSubmitButton () {
    if (!this.elements.submitBtn) return

    // Retirer les anciens listeners (si présents)
    const newBtn = this.elements.submitBtn.cloneNode(true)
    this.elements.submitBtn.parentNode.replaceChild(
      newBtn,
      this.elements.submitBtn
    )
    this.elements.submitBtn = newBtn

    this.elements.submitBtn.addEventListener('click', () => {
      this.validateAnswers()
    })
  }

  validateAnswers () {
    let score = 0

    this.questions.forEach((q, index) => {
      const inputs = document.querySelectorAll(
        `input[name="question-${index}"]`
      )
      const selected = document.querySelectorAll(
        `input[name="question-${index}"]:checked`
      )
      const selectedValues = Array.from(selected).map(input => input.value)

      const correctAnswers = q.corrects || []
      const isCorrect =
        selectedValues.length === correctAnswers.length &&
        selectedValues.every(val => correctAnswers.includes(val))

      if (isCorrect) score++

      // 👉 Coloration des réponses
      inputs.forEach(input => {
        const label = input.parentElement
        label.classList.remove('wrong', 'correct') // reset couleurs

        if (correctAnswers.includes(input.value)) {
          label.classList.add('correct') // bonne réponse -> vert
        } else if (input.checked) {
          label.classList.add('wrong') // mauvaise cochée -> rouge
        }
        input.disabled = true
      })
    })

    const remarkDivs = document.querySelectorAll('.remark')
    remarkDivs.forEach(div => div.classList.remove('nodisplay'))

    if (this.elements.result) {
      let note = score / this.questions.length
      this.elements.result.textContent = `Score :\n${score} / ${this.questions.length}`
      this.elements.result.style.zIndex = 30
      if (note < 0.3) {
        this.elements.result.style.color = '#c00'
        this.elements.result.style.border = '3px solid #c00'
        this.elements.result.style.boxShadow = '0 0 30px rgba(255, 0, 0, 0.76)'
      } else if (note < 0.6) {
        this.elements.result.style.color = '#cc7f14'
        this.elements.result.style.border = '3px solid #cc7f14'
        this.elements.result.style.boxShadow =
          '0 0 30px rgba(204, 127, 20, 0.76)'
      } else {
        this.elements.result.style.color = '#03cc00'
        this.elements.result.style.border = '3px solid #03cc00'
        this.elements.result.style.boxShadow = '0 0 30px rgba(3, 204, 0, 0.76)'
      }
    }
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  window.quizManager = new QuizManager()
})

export { QuizManager }
