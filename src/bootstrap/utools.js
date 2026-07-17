import { notifyClipboardEnter } from '../composables/useUtoolsClipboardEnter'
import {
  isMainPushSearchAction,
  notifyMainPushEnter,
} from '../composables/useUtoolsMainPushEnter'
import {
  setupUtoolsSubInput,
  syncUtoolsSubInput,
} from '../composables/useUtoolsSubInputSearch'
import { setupUtoolsWindow, syncUtoolsWindowLayout } from '../composables/useUtoolsWindow'
import { setupMainPushSearch } from './mainPushSearch'
import { setupUtoolsTools } from './utoolsTools'

export function setupUtools() {
  if (typeof window === 'undefined' || !window.utools) return

  setupUtoolsWindow()
  setupUtoolsTools()
  setupMainPushSearch()
  setupUtoolsSubInput()

  window.utools.onPluginEnter((action) => {
    window.__utoolsEnterAction = action
    syncUtoolsWindowLayout()
    syncUtoolsSubInput()
    if (isMainPushSearchAction(action)) {
      notifyMainPushEnter(action)
      return
    }
    notifyClipboardEnter(action)
  })

  window.utools.onPluginOut(() => {
    window.__utoolsEnterAction = null
  })
}
