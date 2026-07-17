import { ref } from 'vue'

const SEARCH_NOTES_CODE = 'search_notes'

const pendingSearch = ref(null)
const listeners = new Set()

function readWindowPending() {
  return window.__lanbitouPendingSearch || window.__lanbitouOpenNote || null
}

export function isMainPushSearchAction(action) {
  if (!action || action.code !== SEARCH_NOTES_CODE) return false
  if (action.option?.noteId) return true
  if (typeof action.payload === 'string' && action.payload.trim()) return true
  const pending = readWindowPending()
  return !!(pending?.keyword || pending?.id || pending?.noteId)
}

/** @deprecated 兼容旧调用名 */
export function isMainPushOpenNoteAction(action) {
  return isMainPushSearchAction(action)
}

export function resolveSearchFromAction(action) {
  const pending = readWindowPending()
  const keyword = String(
    (typeof action?.payload === 'string' && action.payload) ||
      pending?.keyword ||
      '',
  ).trim()

  const noteId = action?.option?.noteId || pending?.noteId || pending?.id || ''
  const noteType =
    action?.option?.noteType || pending?.noteType || pending?.type || 'fragment'
  const title =
    action?.option?.noteTitle ||
    action?.option?.title ||
    pending?.title ||
    ''

  if (!keyword && !noteId) return null
  return {
    keyword,
    noteId,
    type: noteType,
    title,
  }
}

/** @deprecated */
export function resolveOpenNoteFromAction(action) {
  return resolveSearchFromAction(action)
}

export function notifyMainPushEnter(action) {
  const item = resolveSearchFromAction(action)
  if (!item) return
  window.__lanbitouPendingSearch = null
  window.__lanbitouOpenNote = null
  pendingSearch.value = item
  listeners.forEach((listener) => listener(item))
}

export function takePendingSearch() {
  const item = pendingSearch.value
  pendingSearch.value = null
  return item
}

/** @deprecated */
export function takePendingOpenNote() {
  return takePendingSearch()
}

export function onMainPushSearch(callback) {
  listeners.add(callback)
  if (pendingSearch.value) callback(pendingSearch.value)
  const winPending = readWindowPending()
  if (!pendingSearch.value && (winPending?.keyword || winPending?.noteId || winPending?.id)) {
    const item = resolveSearchFromAction({ code: SEARCH_NOTES_CODE, payload: winPending.keyword || '' })
    if (item) {
      window.__lanbitouPendingSearch = null
      window.__lanbitouOpenNote = null
      pendingSearch.value = item
      callback(item)
    }
  }
  return () => listeners.delete(callback)
}

/** @deprecated */
export function onMainPushOpenNote(callback) {
  return onMainPushSearch(callback)
}
