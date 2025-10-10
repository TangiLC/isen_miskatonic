// select-manager.js - Gestionnaire des select multiples
import { Utils } from './utils.js'

export class SelectManager {
  static fillSelect (selectEl, selectedValues = []) {
    if (!selectEl) return

    const selectedSet = new Set(selectedValues || [])

    Array.from(selectEl.options).forEach(option => {
      option.selected = selectedSet.has(option.value)
    })

    selectedValues
      .filter(value => {
        const val = String(value).trim()
        return val && !Array.from(selectEl.options).some(o => o.value === val)
      })
      .forEach(value => {
        const option = document.createElement('option')
        option.value = value
        option.textContent = value
        option.selected = true
        selectEl.appendChild(option)
      })
  }

  static fillSelectViewOnly (selectEl, selectedValues = []) {
    if (!selectEl) return

    selectEl.innerHTML = ''
    selectedValues.forEach(value => {
      const val = String(value).trim()
      if (!val) return

      const option = document.createElement('option')
      option.value = val
      option.textContent = val
      option.selected = true
      selectEl.appendChild(option)
    })
  }

  static fillSelectOptions (selectEl, values = []) {
    if (!selectEl) return

    const existing = new Set(Array.from(selectEl.options).map(o => o.value))

    values.forEach(v => {
      const val = String(v).trim()
      if (!val || existing.has(val)) return

      existing.add(val)

      const opt = document.createElement('option')
      opt.value = val
      opt.textContent = val
      selectEl.appendChild(opt)
    })
  }

  static addOptionIfMissing (selectEl, value) {
    if (!selectEl) return

    const val = String(value || '').trim()
    if (!val) return

    const exists = Utils.$$('option', selectEl).some(o => o.value === val)
    if (!exists) {
      const opt = document.createElement('option')
      opt.value = val
      opt.textContent = val
      selectEl.appendChild(opt)
    }

    Utils.$$('option', selectEl).forEach(o => {
      o.selected = o.value === val
    })
  }

  static collectMultiSelect (selectEl) {
    if (!selectEl) return []
    return Utils.$$('option:checked', selectEl).map(o => o.value)
  }

  static clearSelection (selectEl) {
    if (!selectEl) return
    Array.from(selectEl.options).forEach(option => {
      option.selected = false
    })
  }
}
