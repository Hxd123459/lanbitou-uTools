import { readonly, ref } from 'vue'
import { isUtoolsMode } from '../storage/env'

const compactSidebar = ref(false)
let initialized = false

/** uTools 主窗口（搜索框内嵌）时为 true，分离/独立窗口时为 false */
export function isUtoolsMainWindow() {
  if (!isUtoolsMode() || typeof window.utools?.getWindowType !== 'function') {
    return false
  }
  return window.utools.getWindowType() === 'main'
}

export function syncUtoolsWindowLayout() {
  const compact = isUtoolsMainWindow()
  compactSidebar.value = compact

  if (typeof document === 'undefined') return

  if (compact) {
    document.documentElement.dataset.utoolsCompact = 'true'
  } else {
    delete document.documentElement.dataset.utoolsCompact
  }
}

export function setupUtoolsWindow() {
  if (!isUtoolsMode() || initialized) return
  initialized = true

  syncUtoolsWindowLayout()

  window.addEventListener('resize', syncUtoolsWindowLayout)

  const { utools } = window
  if (typeof utools.onPluginDetach === 'function') {
    utools.onPluginDetach(syncUtoolsWindowLayout)
  }
}

export function useUtoolsCompactSidebar() {
  return readonly(compactSidebar)
}
