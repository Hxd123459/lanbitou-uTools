import { TODO_RUN_PREFIX } from './constants'
import { dbAllDocs, dbGet, dbPut } from './dbClient'
import { createId, formatDateTime } from './utils'

const MAX_LOG_CHARS = 20000

function runDocId(id) {
  return `${TODO_RUN_PREFIX}${id}`
}

function stripDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

function truncateLog(text) {
  const raw = String(text ?? '')
  if (raw.length <= MAX_LOG_CHARS) return raw
  return `${raw.slice(0, MAX_LOG_CHARS)}\n…(日志已截断)`
}

function toRun(doc) {
  if (!doc?.id) return null
  return {
    id: doc.id,
    todoId: doc.todoId || '',
    projectId: doc.projectId || '',
    provider: doc.provider || 'cursor',
    status: doc.status || 'queued',
    prompt: doc.prompt || '',
    log: doc.log || '',
    summary: doc.summary || '',
    changedFiles: Array.isArray(doc.changedFiles) ? doc.changedFiles : [],
    agentId: doc.agentId || null,
    bridgeRunId: doc.bridgeRunId || null,
    error: doc.error || '',
    startedAt: doc.startedAt || null,
    finishedAt: doc.finishedAt || null,
    createTime: doc.createTime || '',
    updateTime: doc.updateTime || '',
  }
}

async function getRunDoc(id) {
  const raw = stripDoc(await dbGet(runDocId(id)))
  return raw?.id ? raw : null
}

async function saveRunDoc(doc) {
  const payload = { ...doc, _id: runDocId(doc.id) }
  const result = await dbPut(payload)
  if (result?.rev) doc._rev = result.rev
  return doc
}

export async function createTodoRun({
  todoId,
  projectId,
  provider = 'cursor',
  prompt = '',
  status = 'queued',
} = {}) {
  const tid = String(todoId ?? '').trim()
  const pid = String(projectId ?? '').trim()
  if (!tid) throw new Error('缺少待办 ID')
  if (!pid) throw new Error('缺少事情 ID')

  const now = formatDateTime()
  const doc = {
    id: createId(),
    todoId: tid,
    projectId: pid,
    provider: String(provider || 'cursor'),
    status: String(status || 'queued'),
    prompt: String(prompt || ''),
    log: '',
    summary: '',
    changedFiles: [],
    agentId: null,
    bridgeRunId: null,
    error: '',
    startedAt: null,
    finishedAt: null,
    createTime: now,
    updateTime: now,
  }
  await saveRunDoc(doc)
  return toRun(doc)
}

export async function getTodoRun(id) {
  const doc = await getRunDoc(String(id ?? '').trim())
  return toRun(doc)
}

export async function updateTodoRun(id, patch = {}) {
  const doc = await getRunDoc(String(id ?? '').trim())
  if (!doc) throw new Error('执行记录不存在')

  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    doc.status = String(patch.status || doc.status)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'prompt')) {
    doc.prompt = String(patch.prompt ?? '')
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'log')) {
    doc.log = truncateLog(patch.log)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'summary')) {
    doc.summary = String(patch.summary ?? '')
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'changedFiles')) {
    doc.changedFiles = Array.isArray(patch.changedFiles)
      ? patch.changedFiles.map(String).filter(Boolean)
      : []
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'agentId')) {
    doc.agentId = patch.agentId ? String(patch.agentId) : null
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'bridgeRunId')) {
    doc.bridgeRunId = patch.bridgeRunId ? String(patch.bridgeRunId) : null
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'error')) {
    doc.error = String(patch.error ?? '')
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'startedAt')) {
    doc.startedAt = patch.startedAt || null
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'finishedAt')) {
    doc.finishedAt = patch.finishedAt || null
  }

  doc.updateTime = formatDateTime()
  await saveRunDoc(doc)
  return toRun(doc)
}

export async function listTodoRunsByTodo(todoId, { limit = 20 } = {}) {
  const tid = String(todoId ?? '').trim()
  if (!tid) return []
  const docs = await dbAllDocs(TODO_RUN_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && String(doc.todoId) === tid)
    .map(toRun)
    .filter(Boolean)
    .sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))
    .slice(0, Math.max(1, Number(limit) || 20))
}

export async function listTodoRunsByProject(projectId, { limit = 50 } = {}) {
  const pid = String(projectId ?? '').trim()
  if (!pid) return []
  const docs = await dbAllDocs(TODO_RUN_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && String(doc.projectId) === pid)
    .map(toRun)
    .filter(Boolean)
    .sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))
    .slice(0, Math.max(1, Number(limit) || 50))
}
