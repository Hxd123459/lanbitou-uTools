const STORAGE_KEY = 'lanbitou.todoSyncPending.v1'

function readAll() {
  try {
    if (typeof sessionStorage === 'undefined') return {}
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(map) {
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}))
  } catch {
    /* ignore quota */
  }
}

/**
 * @returns {{ projectId: string, projectName?: string, candidates: any[], createdAt: string, source?: string } | null}
 */
export function getPendingTodoSync(projectId) {
  const id = String(projectId || '').trim()
  if (!id) return null
  const entry = readAll()[id]
  if (!entry || !Array.isArray(entry.candidates) || !entry.candidates.length) return null
  return {
    projectId: id,
    projectName: entry.projectName || '',
    candidates: entry.candidates,
    createdAt: entry.createdAt || '',
    source: entry.source || '',
  }
}

export function setPendingTodoSync(projectId, { candidates, projectName = '', source = '' } = {}) {
  const id = String(projectId || '').trim()
  if (!id) return
  const list = Array.isArray(candidates) ? candidates : []
  if (!list.length) {
    clearPendingTodoSync(id)
    return
  }
  const map = readAll()
  map[id] = {
    projectId: id,
    projectName: String(projectName || ''),
    candidates: list,
    createdAt: new Date().toISOString(),
    source: String(source || ''),
  }
  writeAll(map)
}

export function clearPendingTodoSync(projectId) {
  const id = String(projectId || '').trim()
  if (!id) return
  const map = readAll()
  if (!map[id]) return
  delete map[id]
  writeAll(map)
}

export function hasPendingTodoSync(projectId) {
  return Boolean(getPendingTodoSync(projectId))
}
