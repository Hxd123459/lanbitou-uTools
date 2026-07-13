import { reactive, readonly } from 'vue'

export const MascotPhase = {
  PEEK: 'peek',
  SPEAKING: 'speaking',
}

const state = reactive({
  enabled: readEnabled(),
  phase: MascotPhase.PEEK,
  message: '',
})

const listeners = new Set()
let hideTimer = 0
let token = 0

function readEnabled() {
  try {
    const raw = localStorage.getItem('lanbitou/mascot-enabled')
    if (raw === '0' || raw === 'false') return false
  } catch {
    // ignore
  }
  return true
}

export function isLanbitouMascotEnabled() {
  return state.enabled
}

export function setLanbitouMascotEnabled(enabled) {
  state.enabled = enabled === true
  try {
    localStorage.setItem('lanbitou/mascot-enabled', state.enabled ? '1' : '0')
  } catch {
    // ignore
  }
  if (!state.enabled) {
    resetLanbitouMascot()
  }
}

export const lanbitouMascotState = readonly(state)

export function onLanbitouFragmentSaved(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

/** 业务侧唯一入口：记录碎片成功后调用，与 UI 完全解耦 */
export function notifyLanbitouFragmentSaved(payload = {}) {
  if (!state.enabled) return
  listeners.forEach((handler) => {
    try {
      handler(payload)
    } catch (error) {
      console.warn('[烂笔头吉祥物] 事件处理失败', error)
    }
  })
}

export function setLanbitouMascotSpeaking(message, { duration = 9000 } = {}) {
  const nextToken = ++token
  window.clearTimeout(hideTimer)
  state.message = String(message ?? '').trim()
  state.phase = MascotPhase.SPEAKING

  hideTimer = window.setTimeout(() => {
    if (nextToken !== token) return
    dismissLanbitouMascot()
  }, duration)
}

/** 先收起气泡，再缩回 peek，保证退出动画完整播放 */
export function dismissLanbitouMascot() {
  token += 1
  window.clearTimeout(hideTimer)
  state.phase = MascotPhase.PEEK
  window.setTimeout(() => {
    if (state.phase !== MascotPhase.PEEK) return
    state.message = ''
  }, 320)
}

export function resetLanbitouMascot() {
  token += 1
  window.clearTimeout(hideTimer)
  state.phase = MascotPhase.PEEK
  state.message = ''
}
