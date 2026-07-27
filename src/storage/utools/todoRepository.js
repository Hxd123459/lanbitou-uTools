import { NOTE_PREFIX, TODO_PREFIX } from './constants'
import { normalizeTodoRunStatus, TODO_RUN_STATUS } from '../../constants/todoRunStatus'
import { dbAllDocs, dbGet, dbPut } from './dbClient'
import { createId, formatDateTime } from './utils'

const FIRST_SYNC_NOTE_LIMIT = 50

function todoDocId(id) {
  return `${TODO_PREFIX}${id}`
}

function stripDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

export function normalizeTodoTitle(title) {
  return String(title ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function buildTodoSourceHash(noteId, title) {
  const nid = String(noteId ?? '').trim()
  const normalized = normalizeTodoTitle(title).toLowerCase()
  return `${nid}::${normalized}`
}

function toTodo(doc) {
  if (!doc?.id) return null
  return {
    id: doc.id,
    projectId: doc.projectId || '',
    title: doc.title || '',
    done: Boolean(doc.done),
    priority: doc.priority === 'high' ? 'high' : 'normal',
    createdBy: doc.createdBy === 'sync' ? 'sync' : 'manual',
    sourceNoteId: doc.sourceNoteId || null,
    sourceNoteTitle: doc.sourceNoteTitle || '',
    sourceTagId: doc.sourceTagId || null,
    sourceTagName: doc.sourceTagName || '',
    sourceExcerpt: doc.sourceExcerpt || '',
    sourceHash: doc.sourceHash || null,
    runStatus: normalizeTodoRunStatus(doc.runStatus),
    lastRunId: doc.lastRunId ? String(doc.lastRunId) : null,
    createTime: doc.createTime || '',
    updateTime: doc.updateTime || '',
    deletedAt: doc.deletedAt || null,
  }
}

async function getTodoDoc(id) {
  const raw = stripDoc(await dbGet(todoDocId(id)))
  return raw?.id ? raw : null
}

async function saveTodoDoc(doc) {
  const payload = { ...doc, _id: todoDocId(doc.id) }
  const result = await dbPut(payload)
  if (result?.rev) doc._rev = result.rev
  return doc
}

async function loadAllTodoDocs({ includeDeleted = false } = {}) {
  const docs = await dbAllDocs(TODO_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && (includeDeleted || !doc.deletedAt))
}

function stripNoteDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

export async function listTodosByProject(projectId, { includeDeleted = false } = {}) {
  const pid = String(projectId ?? '').trim()
  if (!pid) return []
  const docs = await loadAllTodoDocs({ includeDeleted })
  return docs
    .filter((doc) => String(doc.projectId) === pid)
    .map(toTodo)
    .filter(Boolean)
    .sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))
}

/** @returns {Record<string, { total: number, done: number, pending: number }>} */
export async function countTodosByProject() {
  const docs = await loadAllTodoDocs()
  const map = {}
  for (const doc of docs) {
    const pid = String(doc.projectId || '').trim()
    if (!pid) continue
    if (!map[pid]) map[pid] = { total: 0, done: 0, pending: 0 }
    map[pid].total += 1
    if (doc.done) map[pid].done += 1
    else map[pid].pending += 1
  }
  return map
}

export async function listTodosBySourceNoteIds(noteIds = [], { projectId = null } = {}) {
  const idSet = new Set((Array.isArray(noteIds) ? noteIds : []).map(String).filter(Boolean))
  if (!idSet.size) return []
  const docs = await loadAllTodoDocs()
  const pid = projectId != null ? String(projectId).trim() : ''
  return docs
    .filter((doc) => {
      if (!doc.sourceNoteId || !idSet.has(String(doc.sourceNoteId))) return false
      if (pid && String(doc.projectId) !== pid) return false
      return true
    })
    .map(toTodo)
    .filter(Boolean)
}

export async function listSourceHashesByProject(projectId) {
  const todos = await listTodosByProject(projectId)
  return new Set(todos.map((item) => item.sourceHash).filter(Boolean))
}

export async function createTodo({
  projectId,
  title,
  done = false,
  priority = 'normal',
  createdBy = 'manual',
  sourceNoteId = null,
  sourceNoteTitle = '',
  sourceTagId = null,
  sourceTagName = '',
  sourceExcerpt = '',
  sourceHash = null,
} = {}) {
  const pid = String(projectId ?? '').trim()
  if (!pid) throw new Error('缺少事情 ID')
  const trimmed = normalizeTodoTitle(title)
  if (!trimmed) throw new Error('待办内容不能为空')

  const by = createdBy === 'sync' ? 'sync' : 'manual'
  const noteId = sourceNoteId ? String(sourceNoteId).trim() : null
  if (by === 'sync' && !noteId) throw new Error('同步待办必须保留来源碎片')

  const hash =
    sourceHash ||
    (noteId ? buildTodoSourceHash(noteId, trimmed) : null)

  const now = formatDateTime()
  const doc = {
    id: createId(),
    projectId: pid,
    title: trimmed,
    done: Boolean(done),
    priority: priority === 'high' ? 'high' : 'normal',
    createdBy: by,
    sourceNoteId: noteId,
    sourceNoteTitle: String(sourceNoteTitle ?? '').trim(),
    sourceTagId: sourceTagId ? String(sourceTagId).trim() : null,
    sourceTagName: String(sourceTagName ?? '').trim(),
    sourceExcerpt: String(sourceExcerpt ?? '').trim(),
    sourceHash: hash,
    runStatus: TODO_RUN_STATUS.IDLE,
    lastRunId: null,
    createTime: now,
    updateTime: now,
    deletedAt: null,
  }
  await saveTodoDoc(doc)
  return toTodo(doc)
}

export async function updateTodo(id, patch = {}) {
  const doc = await getTodoDoc(String(id ?? '').trim())
  if (!doc || doc.deletedAt) throw new Error('待办不存在')

  if (patch.title != null) {
    const trimmed = normalizeTodoTitle(patch.title)
    if (!trimmed) throw new Error('待办内容不能为空')
    doc.title = trimmed
    if (doc.sourceNoteId) {
      doc.sourceHash = buildTodoSourceHash(doc.sourceNoteId, trimmed)
    }
  }
  if (patch.done != null) doc.done = Boolean(patch.done)
  if (patch.priority != null) {
    doc.priority = patch.priority === 'high' ? 'high' : 'normal'
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'runStatus')) {
    doc.runStatus = normalizeTodoRunStatus(patch.runStatus)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lastRunId')) {
    doc.lastRunId = patch.lastRunId ? String(patch.lastRunId) : null
  }

  doc.updateTime = formatDateTime()
  await saveTodoDoc(doc)
  return toTodo(doc)
}

export async function toggleTodoDone(id) {
  const doc = await getTodoDoc(String(id ?? '').trim())
  if (!doc || doc.deletedAt) throw new Error('待办不存在')
  doc.done = !doc.done
  doc.updateTime = formatDateTime()
  await saveTodoDoc(doc)
  return toTodo(doc)
}

export async function deleteTodoToRecycle(id) {
  const doc = await getTodoDoc(String(id ?? '').trim())
  if (!doc) return false
  doc.deletedAt = formatDateTime()
  doc.updateTime = formatDateTime()
  await saveTodoDoc(doc)
  return true
}

export async function restoreTodo(id) {
  const doc = await getTodoDoc(String(id ?? '').trim())
  if (!doc) return false
  doc.deletedAt = null
  doc.updateTime = formatDateTime()
  await saveTodoDoc(doc)
  return true
}

export async function softDeleteTodosByProject(projectId) {
  const pid = String(projectId ?? '').trim()
  if (!pid) return 0
  const docs = await loadAllTodoDocs()
  const now = formatDateTime()
  let count = 0
  for (const doc of docs) {
    if (String(doc.projectId) !== pid || doc.deletedAt) continue
    doc.deletedAt = now
    doc.updateTime = now
    await saveTodoDoc(doc)
    count += 1
  }
  return count
}

/**
 * 增量拉取可用于待办同步的碎片。
 * since 为空时取各标签下最近 FIRST_SYNC_NOTE_LIMIT 条，避免首次灌爆。
 */
export async function listNotesForTodoSync({ tagIds = [], since = null } = {}) {
  const tags = [...new Set((Array.isArray(tagIds) ? tagIds : []).map((id) => String(id).trim()).filter(Boolean))]
  if (!tags.length) return []

  const tagSet = new Set(tags)
  const sinceText = since ? String(since).trim() : ''
  const docs = await dbAllDocs(NOTE_PREFIX)
  const notes = (docs || [])
    .map(stripNoteDoc)
    .filter((doc) => {
      if (!doc?.id || doc.deletedAt || doc.archivedAt) return false
      if (!doc.tagId || !tagSet.has(String(doc.tagId))) return false
      if (sinceText && String(doc.createTime || '') <= sinceText) return false
      return true
    })
    .sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))

  const limited = sinceText ? notes : notes.slice(0, FIRST_SYNC_NOTE_LIMIT)

  return limited.map((doc) => ({
    id: doc.id,
    title: doc.title || '',
    tagId: doc.tagId ?? null,
    rawContent: doc.rawContent || '',
    markdownContent: doc.markdownContent || '',
    createTime: doc.createTime || '',
    updateTime: doc.updateTime || '',
  }))
}
