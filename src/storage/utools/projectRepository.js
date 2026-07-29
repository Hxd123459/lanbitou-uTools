import { PROJECT_PREFIX } from './constants'
import { dbAllDocs, dbGet, dbPut } from './dbClient'
import { createId, formatDateTime } from './utils'
import { MAX_PROJECTS, MAX_TAGS_PER_PROJECT } from '../../constants/todoLimits'

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
    if (result.length >= MAX_TAGS_PER_PROJECT) break
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

function normalizeLocalPath(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeSedimentFolderId(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeDecisions(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => {
      const text = String(item?.text ?? item ?? '').trim()
      if (!text) return null
      return {
        at: String(item?.at || '').trim() || formatDateTime().slice(0, 10),
        text: text.slice(0, 500),
      }
    })
    .filter(Boolean)
    .slice(0, 50)
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
    localPath: normalizeLocalPath(doc.localPath),
    archivePath: normalizeLocalPath(doc.archivePath),
    sedimentFolderId: normalizeSedimentFolderId(doc.sedimentFolderId),
    purpose: String(doc.purpose || ''),
    successLooksLike: String(doc.successLooksLike || ''),
    outOfScope: String(doc.outOfScope || ''),
    decisions: normalizeDecisions(doc.decisions),
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

export async function createProject({
  name,
  tagIds = [],
  startAt = null,
  endAt = null,
  localPath = null,
  archivePath = null,
  sedimentFolderId = null,
  purpose = '',
  successLooksLike = '',
  outOfScope = '',
  decisions = [],
} = {}) {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) throw new Error('事情名称不能为空')

  const existing = await loadAllProjectDocs()
  if (existing.length >= MAX_PROJECTS) {
    throw new Error(`最多只能创建 ${MAX_PROJECTS} 件事情`)
  }

  const normalizedTags = normalizeTagIds(tagIds)
  if (Array.isArray(tagIds) && tagIds.filter(Boolean).length > MAX_TAGS_PER_PROJECT) {
    throw new Error('一件事情只能绑定 1 个标签')
  }

  const now = formatDateTime()
  const start = normalizeProjectDate(startAt) || todayDatePart()
  const end = normalizeProjectDate(endAt)
  if (end && start && end < start) {
    throw new Error('结束时间不能早于开始时间')
  }

  const doc = {
    id: createId(),
    name: trimmed,
    tagIds: normalizedTags,
    status: 'active',
    startAt: start,
    endAt: end,
    localPath: normalizeLocalPath(localPath),
    archivePath: normalizeLocalPath(archivePath),
    sedimentFolderId: normalizeSedimentFolderId(sedimentFolderId),
    purpose: String(purpose || '').slice(0, 2000),
    successLooksLike: String(successLooksLike || '').slice(0, 2000),
    outOfScope: String(outOfScope || '').slice(0, 2000),
    decisions: normalizeDecisions(decisions),
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
    if (Array.isArray(patch.tagIds) && patch.tagIds.filter(Boolean).length > MAX_TAGS_PER_PROJECT) {
      throw new Error('一件事情只能绑定 1 个标签')
    }
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
  if (Object.prototype.hasOwnProperty.call(patch, 'localPath')) {
    doc.localPath = normalizeLocalPath(patch.localPath)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'archivePath')) {
    doc.archivePath = normalizeLocalPath(patch.archivePath)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'sedimentFolderId')) {
    doc.sedimentFolderId = normalizeSedimentFolderId(patch.sedimentFolderId)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'purpose')) {
    doc.purpose = String(patch.purpose ?? '').slice(0, 2000)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'successLooksLike')) {
    doc.successLooksLike = String(patch.successLooksLike ?? '').slice(0, 2000)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'outOfScope')) {
    doc.outOfScope = String(patch.outOfScope ?? '').slice(0, 2000)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'decisions')) {
    doc.decisions = normalizeDecisions(patch.decisions)
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
