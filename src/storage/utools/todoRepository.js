import { NOTE_PREFIX, TODO_PREFIX } from './constants'
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
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildTodoSourceHash(noteId, title) {
  const nid = String(noteId ?? '').trim()
  const normalized = normalizeTodoTitle(title).replace(/\s+/g, ' ').toLowerCase()
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
    doneWhen: doc.doneWhen || '',
    sourceHash: doc.sourceHash || null,
    sortOrder: Number.isFinite(Number(doc.sortOrder)) ? Number(doc.sortOrder) : null,
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

function compareTodos(a, b) {
  const ao = a?.sortOrder
  const bo = b?.sortOrder
  if (ao != null && bo != null && ao !== bo) return ao - bo
  if (ao != null && bo == null) return -1
  if (ao == null && bo != null) return 1
  return String(b?.createTime || '').localeCompare(String(a?.createTime || ''))
}

export async function listTodosByProject(projectId, { includeDeleted = false } = {}) {
  const pid = String(projectId ?? '').trim()
  if (!pid) return []
  const docs = await loadAllTodoDocs({ includeDeleted })
  return docs
    .filter((doc) => String(doc.projectId) === pid)
    .map(toTodo)
    .filter(Boolean)
    .sort(compareTodos)
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
  doneWhen = '',
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

  const existing = await listTodosByProject(pid)
  const existingOrders = existing
    .map((item) => Number(item.sortOrder))
    .filter((n) => Number.isFinite(n))
  const nextSortOrder = existingOrders.length ? Math.min(...existingOrders) - 1 : 0

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
    doneWhen: String(doneWhen ?? '').trim().slice(0, 120),
    sourceHash: hash,
    sortOrder: nextSortOrder,
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
  if (Object.prototype.hasOwnProperty.call(patch, 'doneWhen')) {
    doc.doneWhen = String(patch.doneWhen ?? '').trim().slice(0, 120)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'sourceExcerpt')) {
    doc.sourceExcerpt = String(patch.sourceExcerpt ?? '').trim()
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'sortOrder')) {
    const n = Number(patch.sortOrder)
    doc.sortOrder = Number.isFinite(n) ? n : 0
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

/** @param {string[]} orderedIds */
export async function reorderTodos(orderedIds = []) {
  const ids = (Array.isArray(orderedIds) ? orderedIds : [])
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
  if (!ids.length) return []

  const now = formatDateTime()
  const updated = []
  for (let index = 0; index < ids.length; index += 1) {
    const doc = await getTodoDoc(ids[index])
    if (!doc || doc.deletedAt) continue
    doc.sortOrder = index
    doc.updateTime = now
    await saveTodoDoc(doc)
    updated.push(toTodo(doc))
  }
  return updated
}

/**
 * 增量拉取可用于待办同步的碎片。
 * since 为空时取各标签下最近 FIRST_SYNC_NOTE_LIMIT 条，避免首次灌爆。
 * 增量时仅纳入 createTime 晚于 since 的新增碎片。
 */
export async function listNotesForTodoSync({ tagIds = [], since = null } = {}) {
  const tags = [...new Set((Array.isArray(tagIds) ? tagIds : []).map((id) => String(id).trim()).filter(Boolean))]
  if (!tags.length) return []

  const tagSet = new Set(tags)
  const sinceText = since ? String(since).trim() : ''
  const docs = await dbAllDocs(NOTE_PREFIX)

  const noteCreateTime = (doc) => String(doc?.createTime || '').trim()

  const notes = (docs || [])
    .map(stripNoteDoc)
    .filter((doc) => {
      if (!doc?.id || doc.deletedAt || doc.archivedAt) return false
      if (!doc.tagId || !tagSet.has(String(doc.tagId))) return false
      const created = noteCreateTime(doc)
      if (!created) return false
      // 有同步起点时：只看新增碎片，不把旧碎片改写算进来
      if (sinceText && created <= sinceText) return false
      return true
    })
    .sort((a, b) => noteCreateTime(b).localeCompare(noteCreateTime(a)))

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
