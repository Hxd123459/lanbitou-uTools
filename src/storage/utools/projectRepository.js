import { PROJECT_PREFIX } from './constants'
import { dbAllDocs, dbGet, dbPut } from './dbClient'
import { createId, formatDateTime } from './utils'

function projectDocId(id) {
  return `${PROJECT_PREFIX}${id}`
}

function stripDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

function normalizeTagIds(tagIds) {
  if (!Array.isArray(tagIds)) return []
  const seen = new Set()
  const result = []
  for (const raw of tagIds) {
    const id = String(raw ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

/** 统一为 YYYY-MM-DD；空则 null */
export function normalizeProjectDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function todayDatePart() {
  return formatDateTime().slice(0, 10)
}

function toProject(doc) {
  if (!doc?.id) return null
  return {
    id: doc.id,
    name: doc.name || '',
    tagIds: normalizeTagIds(doc.tagIds),
    status: doc.status === 'archived' ? 'archived' : 'active',
    startAt: normalizeProjectDate(doc.startAt) || normalizeProjectDate(doc.createTime) || null,
    endAt: normalizeProjectDate(doc.endAt),
    lastSyncedAt: doc.lastSyncedAt || null,
    createTime: doc.createTime || '',
    updateTime: doc.updateTime || '',
    deletedAt: doc.deletedAt || null,
  }
}

async function getProjectDoc(id) {
  const raw = stripDoc(await dbGet(projectDocId(id)))
  return raw?.id ? raw : null
}

async function saveProjectDoc(doc) {
  const payload = { ...doc, _id: projectDocId(doc.id) }
  const result = await dbPut(payload)
  if (result?.rev) doc._rev = result.rev
  return doc
}

async function loadAllProjectDocs({ includeDeleted = false } = {}) {
  const docs = await dbAllDocs(PROJECT_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && (includeDeleted || !doc.deletedAt))
}

export async function listProjects({ includeArchived = false, includeDeleted = false } = {}) {
  const docs = await loadAllProjectDocs({ includeDeleted })
  return docs
    .map(toProject)
    .filter((item) => item && (includeArchived || item.status !== 'archived'))
    .sort((a, b) => String(b.updateTime || b.createTime || '').localeCompare(String(a.updateTime || a.createTime || '')))
}

export async function getProject(id) {
  const doc = await getProjectDoc(String(id ?? '').trim())
  if (!doc || doc.deletedAt) return null
  return toProject(doc)
}

export async function createProject({ name, tagIds = [], startAt = null, endAt = null } = {}) {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) throw new Error('事情名称不能为空')

  const now = formatDateTime()
  const start = normalizeProjectDate(startAt) || todayDatePart()
  const end = normalizeProjectDate(endAt)
  if (end && start && end < start) {
    throw new Error('结束时间不能早于开始时间')
  }

  const doc = {
    id: createId(),
    name: trimmed,
    tagIds: normalizeTagIds(tagIds),
    status: 'active',
    startAt: start,
    endAt: end,
    lastSyncedAt: null,
    createTime: now,
    updateTime: now,
    deletedAt: null,
  }
  await saveProjectDoc(doc)
  return toProject(doc)
}

export async function updateProject(id, patch = {}) {
  const doc = await getProjectDoc(String(id ?? '').trim())
  if (!doc || doc.deletedAt) throw new Error('事情不存在')

  if (patch.name != null) {
    const trimmed = String(patch.name).trim()
    if (!trimmed) throw new Error('事情名称不能为空')
    doc.name = trimmed
  }
  if (patch.tagIds != null) {
    doc.tagIds = normalizeTagIds(patch.tagIds)
  }
  if (patch.status != null) {
    doc.status = patch.status === 'archived' ? 'archived' : 'active'
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lastSyncedAt')) {
    doc.lastSyncedAt = patch.lastSyncedAt || null
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'startAt')) {
    doc.startAt = normalizeProjectDate(patch.startAt)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'endAt')) {
    doc.endAt = normalizeProjectDate(patch.endAt)
  }

  const start = normalizeProjectDate(doc.startAt) || normalizeProjectDate(doc.createTime)
  const end = normalizeProjectDate(doc.endAt)
  if (end && start && end < start) {
    throw new Error('结束时间不能早于开始时间')
  }

  doc.updateTime = formatDateTime()
  await saveProjectDoc(doc)
  return toProject(doc)
}

export async function deleteProjectToRecycle(id) {
  const doc = await getProjectDoc(String(id ?? '').trim())
  if (!doc) return false
  doc.deletedAt = formatDateTime()
  doc.updateTime = formatDateTime()
  await saveProjectDoc(doc)
  return true
}

export async function restoreProject(id) {
  const doc = await getProjectDoc(String(id ?? '').trim())
  if (!doc) return false
  doc.deletedAt = null
  doc.updateTime = formatDateTime()
  await saveProjectDoc(doc)
  return true
}
