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
import { maybeRunProfileAnalysis } from '../ai/profileExtractionService'
import { setupMainPushSearch } from './mainPushSearch'
import { setupUtoolsTools } from './utoolsTools'

const PROFILE_ANALYSIS_STARTUP_DELAY_MS = 8000

export function setupUtools() {
  if (typeof window === 'undefined' || !window.utools) return

  setupUtoolsWindow()
  setupUtoolsTools()
  setupMainPushSearch()
  setupUtoolsSubInput()

  // 延迟触发，避免占用启动阶段的资源
  window.setTimeout(() => {
    maybeRunProfileAnalysis()
  }, PROFILE_ANALYSIS_STARTUP_DELAY_MS)

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
    window.dispatchEvent(new Event('lanbitou:plugin-out'))
  })
}
