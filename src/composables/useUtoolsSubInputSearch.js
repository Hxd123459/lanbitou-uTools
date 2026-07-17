/**
 * 监听 uTools 主窗口子输入框（preload 里 setSubInput，经 CustomEvent 传到渲染进程）
 */
const listeners = new Set()

export function notifySubInputSearch(text) {
  const value = String(text ?? '')
  listeners.forEach((listener) => listener(value))
}

export function onSubInputSearch(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function onWindowSubInput(event) {
  const text = event?.detail?.text
  notifySubInputSearch(text == null ? '' : text)
}

/** 渲染进程兜底：若 preload 未绑上，再尝试 setSubInput */
export function syncUtoolsSubInput() {
  if (typeof window === 'undefined' || !window.utools) return
  const { utools } = window
  if (typeof utools.getWindowType === 'function' && utools.getWindowType() !== 'main') {
    if (typeof utools.removeSubInput === 'function') utools.removeSubInput()
    return
  }
  // preload 已负责 setSubInput；这里仅在 preload 标记缺失时兜底
  if (window.__lanbitouPreloadSubInput) return
  if (typeof utools.setSubInput !== 'function') return

  let timer = null
  utools.setSubInput(({ text }) => {
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      notifySubInputSearch(text)
    }, 180)
  }, '搜索笔记…')
}

export function setupUtoolsSubInput() {
  if (typeof window === 'undefined') return
  window.addEventListener('lanbitou:subinput', onWindowSubInput)
}

export function teardownUtoolsSubInput() {
  if (typeof window === 'undefined') return
  window.removeEventListener('lanbitou:subinput', onWindowSubInput)
}
