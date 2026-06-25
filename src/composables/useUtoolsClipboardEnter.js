import { ref } from 'vue'

const pendingAction = ref(null)
const listeners = new Set()
let suppressNextClipboardImage = false
let suppressClipboardImageTimer = null

/** 输入框已通过 paste 事件处理图片，跳过 uTools 剪贴板回车重复添加 */
export function markClipboardImageHandledByPaste() {
  suppressNextClipboardImage = true
  if (suppressClipboardImageTimer) clearTimeout(suppressClipboardImageTimer)
  suppressClipboardImageTimer = setTimeout(() => {
    suppressNextClipboardImage = false
    suppressClipboardImageTimer = null
  }, 800)
}

/** 当前焦点在局部编辑器（碎片编辑 / TipTap 正文），不应把图片写入底部输入栏 */
export function isLocalImagePasteTargetActive() {
  const el = document.activeElement
  if (!el) return false
  if (el.classList?.contains('note-editor')) return true
  if (el.closest?.('.struct-note-md-prosemirror, .ProseMirror')) return true
  return false
}

export function shouldSkipClipboardEnterImage() {
  if (!suppressNextClipboardImage) return false
  suppressNextClipboardImage = false
  if (suppressClipboardImageTimer) {
    clearTimeout(suppressClipboardImageTimer)
    suppressClipboardImageTimer = null
  }
  return true
}

export function isClipboardEnterAction(action) {
  return !!action && (action.type === 'over' || action.type === 'img')
}

function dataUrlToFile(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const [, mime, base64] = match
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const ext = mime.split('/')[1]?.split('+')[0] || 'png'
  return new File([bytes], `clipboard.${ext}`, { type: mime })
}

export async function payloadToImageFile(payload) {
  if (!payload || typeof payload !== 'string') return null

  if (payload.startsWith('data:')) {
    return dataUrlToFile(payload)
  }

  const normalized = payload.replace(/\\/g, '/')
  const fileUrl = /^[a-z]+:\/\//i.test(normalized)
    ? normalized
    : `file:///${encodeURI(normalized.replace(/^\//, ''))}`

  try {
    const res = await fetch(fileUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    const name = normalized.split('/').pop() || 'clipboard.png'
    return new File([blob], name, { type: blob.type || 'image/png' })
  } catch {
    return null
  }
}

export function notifyClipboardEnter(action) {
  if (!isClipboardEnterAction(action)) return
  pendingAction.value = action
  listeners.forEach((listener) => listener(action))
}

export function takePendingClipboardAction() {
  const action = pendingAction.value
  pendingAction.value = null
  return action
}

export function onClipboardEnter(callback) {
  listeners.add(callback)
  if (pendingAction.value) callback(pendingAction.value)
  return () => listeners.delete(callback)
}
