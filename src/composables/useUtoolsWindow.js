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

/** 主窗口下模拟分离快捷键，便于宽屏编辑（Win/Linux: Ctrl+D，macOS: ⌘+D） */
function getUtoolsDetachModifier() {
  const { utools } = window
  if (typeof utools?.isMacOS === 'function') {
    return utools.isMacOS() ? 'command' : 'ctrl'
  }
  if (typeof navigator !== 'undefined') {
    const platform = navigator.platform || navigator.userAgent || ''
    return /Mac|iPhone|iPad|iPod/.test(platform) ? 'command' : 'ctrl'
  }
  return 'ctrl'
}

export function requestUtoolsDetachIfNeeded() {
  if (!isUtoolsMainWindow()) return Promise.resolve(false)

  const { utools } = window
  if (typeof utools?.simulateKeyboardTap !== 'function') {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    let settled = false
    const modifier = getUtoolsDetachModifier()

    const finish = (success) => {
      if (settled) return
      settled = true
      window.clearTimeout(fallbackTimer)
      syncUtoolsWindowLayout()
      resolve(success)
    }

    const onDetach = () => finish(true)
    if (typeof utools.onPluginDetach === 'function') {
      utools.onPluginDetach(onDetach)
    }

    const fallbackTimer = window.setTimeout(() => {
      finish(!isUtoolsMainWindow())
    }, 800)

    const triggerDetach = () => {
      try {
        if (typeof utools.subInputBlur === 'function') {
          utools.subInputBlur()
        }
        utools.simulateKeyboardTap('d', modifier)
      } catch (error) {
        console.warn('[烂笔头] 分离窗口失败', error)
        finish(false)
      }
    }

    triggerDetach()

    window.setTimeout(() => {
      if (!settled && isUtoolsMainWindow()) {
        triggerDetach()
      }
    }, 280)
  })
}
