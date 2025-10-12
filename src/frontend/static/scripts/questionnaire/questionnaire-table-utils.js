export class QuestionnaireTableUtils {
  static formatId (id) {
    return String(id ?? '').slice(-4)
  }

  static createActionButton ({
    src,
    title,
    onClick,
    disabled = false,
    deleteClass = false
  }) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'action-icon-btn'
    if (deleteClass) btn.className += ' delete'
    btn.title = title
    btn.setAttribute('aria-label', title)

    if (disabled) {
      btn.disabled = true
      btn.classList.add('disabled')
    }

    const img = new Image()
    img.src = src
    img.alt = title

    btn.appendChild(img)
    btn.addEventListener('click', e => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) onClick()
    })

    return btn
  }

  static getActionsForQuestion (question, index, totalQuestions, callbacks) {
    const actions = []

    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-q-up.svg',
        title: 'Monter la question',
        onClick: () => callbacks.onMove(index, -1),
        disabled: index === 0
      })
    )

    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-q-down.svg',
        title: 'Descendre la question',
        onClick: () => callbacks.onMove(index, 1),
        disabled: index === totalQuestions - 1
      })
    )

    actions.push(
      this.createActionButton({
        src: '/static/assets/icon-q-unselect.svg',
        title: 'Retirer la question',
        onClick: () => callbacks.onRemove(index, question.question),
        deleteClass: true
      })
    )

    return actions
  }

  static renderQuestionsTable (tbody, questions, options = {}) {
    const {
      isReadonly = false,
      callbacks = {},
      emptyMessage = 'Aucune question dans ce questionnaire'
    } = options

    if (!tbody) return

    tbody.innerHTML = ''

    if (!questions || questions.length === 0) {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.colSpan = 4
      td.textContent = emptyMessage
      td.style.textAlign = 'center'
      td.style.fontStyle = 'italic'
      tr.appendChild(td)
      tbody.appendChild(tr)
      return
    }

    questions.forEach((question, index) => {
      const tr = document.createElement('tr')

      const columns = [
        { content: index + 1 },
        { content: QuestionnaireTableUtils.formatId(question.id) },
        { content: question.question || '-' }
      ]

      columns.forEach(col => {
        const td = document.createElement('td')
        td.textContent = col.content
        tr.appendChild(td)
      })

      const actionsCell = document.createElement('td')
      if (!isReadonly && callbacks.onMove && callbacks.onRemove) {
        const actions = QuestionnaireTableUtils.getActionsForQuestion(
          question,
          index,
          questions.length,
          callbacks
        )
        actions.forEach(action => actionsCell.appendChild(action))
      }
      tr.appendChild(actionsCell)

      tbody.appendChild(tr)
    })
  }

  static moveQuestion (questions, fromIndex, direction) {
    const toIndex = fromIndex + direction

    if (toIndex < 0 || toIndex >= questions.length) {
      return null
    }

    ;[questions[fromIndex], questions[toIndex]] = [
      questions[toIndex],
      questions[fromIndex]
    ]

    return questions
  }

  static removeQuestion (questions, index, questionText, options = {}) {
    const { skipConfirm = false } = options

    const shortQuestionText =
      questionText.length > 50
        ? questionText.substring(0, 50) + '...'
        : questionText

    if (
      !skipConfirm &&
      !confirm(
        `Êtes-vous sûr de vouloir retirer cette question du questionnaire ?\n\n"${shortQuestionText}"`
      )
    ) {
      return null
    }

    questions.splice(index, 1)
    return questions
  }

  static removeQuestionById (questions, questionId, questionText, options = {}) {
    const index = questions.findIndex(q => q.id === questionId)
    if (index === -1) return null

    return this.removeQuestion(questions, index, questionText, options)
  }
}

export default QuestionnaireTableUtils
