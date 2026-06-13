import { notifyClipboardEnter } from '../composables/useUtoolsClipboardEnter'
import { setupUtoolsWindow, syncUtoolsWindowLayout } from '../composables/useUtoolsWindow'

export function setupUtools() {
  if (typeof window === 'undefined' || !window.utools) return

  setupUtoolsWindow()

  window.utools.onPluginEnter((action) => {
    window.__utoolsEnterAction = action
    syncUtoolsWindowLayout()
    notifyClipboardEnter(action)
  })

  window.utools.onPluginOut(() => {
    window.__utoolsEnterAction = null
  })
}
