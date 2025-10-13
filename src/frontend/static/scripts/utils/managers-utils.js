// common-manager-utils.js - Utilitaires partagés entre managers

/**
 * Classe de base pour les managers avec fonctionnalités communes
 */
export class BaseManager {
  constructor () {
    this.config = window.APP_CONFIG || {}
    this.userNameCache = new Map()
  }

  /**
   * Affiche un message de feedback
   */
  showMessage (msg = '', type = 'info', feedbackElement) {
    if (!feedbackElement) return

    feedbackElement.textContent = msg
    feedbackElement.dataset.type = type
    feedbackElement.classList.remove('success', 'error', 'info')
    feedbackElement.classList.add(type)
  }

  /**
   * Formate une date ISO en format français court
   */
  formatDateTime (iso) {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      })
    } catch {
      return iso
    }
  }

  /**
   * Récupère le nom d'utilisateur avec cache
   */
  async getUserNameFromCache (userId) {
    if (this.userNameCache.has(userId)) {
      return this.userNameCache.get(userId)
    }

    try {
      const response = await fetch(`/api/users/${userId}/name`)
      const result = await response.json()
      const userName = result.userName || 'Inconnu'
      this.userNameCache.set(userId, userName)
      return userName
    } catch (error) {
      console.warn('Erreur récupération nom utilisateur:', error)
      this.userNameCache.set(userId, 'Inconnu')
      return 'Inconnu'
    }
  }

  /**
   * Trouve la date la plus récente parmi plusieurs dates
   */
  getLatestDate (...dates) {
    const validDates = dates
      .flat()
      .filter(Boolean)
      .map(d => new Date(d))
      .filter(d => !isNaN(d))

    if (validDates.length === 0) return null
    return new Date(Math.max(...validDates))
  }

  /**
   * Tronque un texte à une longueur maximale
   */
  truncateText (text, maxLength = 50) {
    if (!text) return ''
    const str = String(text)
    return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str
  }

  /**
   * Formate un ID (affiche les derniers caractères)
   */
  formatId (id, length = 4) {
    return String(id ?? '').slice(-length)
  }

  /**
   * Convertit une valeur ou tableau en texte séparé par des virgules
   */
  toText (value) {
    return Array.isArray(value) ? value.join(', ') : value ?? ''
  }
}

/**
 * Gestionnaire d'actions pour les boutons de tableau
 */
export class ActionButtonBuilder {
  /**
   * Crée un bouton d'action avec icône
   */
  static create ({ src, title, onClick, disabled = false }) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'action-icon-btn'
    btn.title = title
    btn.setAttribute('aria-label', title)
    btn.disabled = disabled

    if (disabled) {
      btn.classList.add('disabled')
    }

    const img = new Image()
    img.src = src
    img.alt = title
    btn.appendChild(img)

    if (onClick && !disabled) {
      btn.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      })
    }

    return btn
  }

  /**
   * Crée une action "Voir"
   */
  static createViewAction (onView) {
    return this.create({
      src: '/static/assets/icon-eye.svg',
      title: 'Voir les détails',
      onClick: onView
    })
  }

  /**
   * Crée une action "Éditer" avec contrôle de permission
   */
  static createEditAction (onEdit, canEdit) {
    return this.create({
      src: '/static/assets/icon-edit.svg',
      title: 'Éditer',
      onClick: onEdit,
      disabled: !canEdit
    })
  }

  /**
   * Crée une action "Ajouter au quiz"
   */
  static createAddToQuizAction (onAdd, canAdd) {
    return this.create({
      src: '/static/assets/icon-q-add.svg',
      title: 'Ajouter au quizz',
      onClick: onAdd,
      disabled: !canAdd
    })
  }

  /**
   * Crée une action "Sélectionner"
   */
  static createSelectAction (onSelect, canSelect) {
    return this.create({
      src: '/static/assets/icon-select.svg',
      title: 'Sélectionner',
      onClick: onSelect,
      disabled: !canSelect
    })
  }
}

/**
 * Gestionnaire de modale générique
 */
export class ModalHelper {
  /**
   * Configure la fermeture de la modale avec Escape
   */
  static setupEscapeClose (modalElement, closeCallback) {
    const handler = e => {
      if (e.key === 'Escape' && modalElement?.style.display !== 'none') {
        closeCallback()
      }
    }
    document.addEventListener('keydown', handler)
    return handler
  }

  /**
   * Configure la fermeture au clic sur le backdrop
   */
  static setupBackdropClose (modalElement, closeCallback) {
    modalElement?.addEventListener('click', e => {
      if (e.target === modalElement) closeCallback()
    })
  }

  /**
   * Remplace un bouton pour nettoyer ses event listeners
   */
  static replaceButton (oldButton) {
    if (!oldButton) return null
    const newButton = oldButton.cloneNode(true)
    oldButton.parentNode.replaceChild(newButton, oldButton)
    return newButton
  }

  /**
   * Configure un bouton de soumission en mode édition
   */
  static setupEditSubmission (submitBtn, resetBtn, onSubmit, onReset) {
    const newSubmit = this.replaceButton(submitBtn)
    const newReset = this.replaceButton(resetBtn)

    if (newSubmit) {
      newSubmit.addEventListener('click', async e => {
        e.preventDefault()
        await onSubmit()
      })
    }

    if (newReset && onReset) {
      newReset.addEventListener('click', onReset)
    }

    return { newSubmit, newReset }
  }
}

/**
 * Gestionnaire de validation temps réel
 */
export class ValidationHelper {
  /**
   * Attache la validation en temps réel sur des inputs
   */
  static attachRealTimeValidation (elements, validator) {
    const { inputs = [], selects = [] } = elements

    inputs.forEach(input => {
      if (input) {
        input.addEventListener('input', () => validator.validateForm())
      }
    })

    selects.forEach(select => {
      if (select) {
        select.addEventListener('change', () => validator.validateForm())
      }
    })
  }

  /**
   * Configure un MutationObserver pour surveiller les changements DOM
   */
  static setupMutationObserver (element, callback) {
    if (!element || !window.MutationObserver) return null

    const observer = new MutationObserver(callback)
    observer.observe(element, {
      childList: true,
      subtree: true
    })

    return observer
  }
}

/**
 * Gestionnaire de chargement de données
 */
export class LoadingHelper {
  /**
   * Gère l'état de chargement d'un bouton
   */
  static async withLoadingButton (button, loadingText, callback) {
    if (!button) return await callback()

    const originalText = button.textContent
    const wasDisabled = button.disabled

    try {
      button.disabled = true
      button.textContent = loadingText

      return await callback()
    } finally {
      button.disabled = wasDisabled
      button.textContent = originalText
    }
  }

  /**
   * Gère le chargement avec feedback message
   */
  static async withFeedback (
    feedbackElement,
    loadingMsg,
    successMsg,
    errorMsg,
    callback
  ) {
    if (feedbackElement) {
      feedbackElement.textContent = loadingMsg
      feedbackElement.dataset.type = 'info'
    }

    try {
      const result = await callback()

      if (feedbackElement && successMsg) {
        feedbackElement.textContent = successMsg
        feedbackElement.dataset.type = 'success'
      }

      return result
    } catch (error) {
      if (feedbackElement && errorMsg) {
        feedbackElement.textContent = errorMsg
        feedbackElement.dataset.type = 'error'
      }
      throw error
    }
  }
}

/**
 * Gestionnaire d'événements personnalisés
 */
export class EventBus {
  /**
   * Émet un événement personnalisé
   */
  static emit (eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail })
    window.dispatchEvent(event)
  }

  /**
   * Écoute un événement personnalisé
   */
  static on (eventName, callback) {
    window.addEventListener(eventName, callback)
    return () => window.removeEventListener(eventName, callback)
  }

  /**
   * Événements pré-définis pour les questions
   */
  static questions = {
    openModal: (id, mode) => EventBus.emit('question:open-modal', { id, mode }),
    addToQuiz: question => EventBus.emit('question:add-to-quiz', { question }),
    created: question => EventBus.emit('question:created', { question }),
    updated: question => EventBus.emit('question:updated', { question })
  }

  /**
   * Événements pré-définis pour les questionnaires
   */
  static questionnaires = {
    openModal: (id, mode, questionnaire) =>
      EventBus.emit('questionnaire:open-modal', { id, mode, questionnaire }),
    create: () => EventBus.emit('questionnaire:create'),
    selected: id => EventBus.emit('questionnaire:selected', { id }),
    created: questionnaire =>
      EventBus.emit('questionnaire:created', { questionnaire }),
    updated: questionnaire =>
      EventBus.emit('questionnaire:updated', { questionnaire })
  }
}

/**
 * Gestionnaire de permissions
 */
export class PermissionChecker {
  /**
   * Vérifie si l'utilisateur peut éditer une ressource
   */
  static canEdit (resource, userId) {
    return String(resource.created_by) === String(userId)
  }

  /**
   * Vérifie si une ressource peut être ajoutée au quiz
   */
  static canAddToQuiz (resource, questionnaireId) {
    return (
      String(resource.status) === 'active' &&
      questionnaireId &&
      questionnaireId !== 'null' &&
      questionnaireId !== 'None' &&
      questionnaireId !== ''
    )
  }

  /**
   * Vérifie si une ressource peut être sélectionnée
   */
  static canSelect (resource) {
    return String(resource.status) !== 'archive'
  }
}

/**
 * Utilitaires de rendu de tableau
 */
export class TableRenderHelper {
  /**
   * Crée une cellule de tableau
   */
  static createCell (content) {
    const td = document.createElement('td')
    td.textContent = content
    return td
  }

  /**
   * Crée une cellule avec des boutons d'action
   */
  static createActionsCell (actions) {
    const td = document.createElement('td')
    td.className = 'actions-cell'
    actions.forEach(btn => td.appendChild(btn))
    return td
  }

  /**
   * Vide et masque un conteneur si vide
   */
  static toggleVisibility (tbody, scrollCard, hasData) {
    if (tbody) tbody.innerHTML = ''
    if (scrollCard) {
      scrollCard.style.display = hasData ? 'inline-block' : 'none'
    }
  }
}

/**
 * Gestionnaire de retry pour les requêtes
 */
export class RetryHelper {
  /**
   * Exécute une fonction avec retry automatique
   */
  static async withRetry (fn, maxRetries = 3, delay = 1000) {
    let lastError

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
        }
      }
    }

    throw lastError
  }
}
