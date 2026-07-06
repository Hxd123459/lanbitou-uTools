import { NOTE_PREFIX } from './constants'
import { createNoteInFolder } from './structRepository'
import {
  findTagByName,
  getTagById,
  listTagsWithCounts,
  removeTagDoc,
  resolveTagForTitle,
  updateTagDoc,
} from './tagRepository'
import { dbAllDocs, dbGet, dbPut, dbRemove } from './dbClient'
import {
  imagesToBlocks,
  removeAttachments,
  revokeNoteAttachmentUrls,
  saveImageFiles,
} from './attachment'
import { pinTypeToWeight, pinWeightToType } from './pin'
import { createId, datePartFromDateTime, formatDateTime } from './utils'
import {
  isTagNameWithinLimit,
  TAG_NAME_MAX_UNITS,
} from '../../utils/tagName'
import { UNTAGGED_TAG_ID } from '../../constants/noteTag'

const NOTE_LIST_PAGE_SIZE = 20

function noteDocId(id) {
  return `${NOTE_PREFIX}${id}`
}

function stripNoteDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

async function loadAllNoteDocs({ includeDeleted = false, includeArchived = false } = {}) {
  const docs = await dbAllDocs(NOTE_PREFIX)
  return (docs || [])
    .map(stripNoteDoc)
    .filter((doc) => doc?.id && (includeDeleted || !doc.deletedAt))
    .filter((doc) => includeArchived || !doc.archivedAt)
}

function toApiNote(doc) {
  const pinWeightType = pinWeightToType(doc.pinWeight)
  return {
    id: doc.id,
    title: doc.title || '',
    fineTitle: doc.fineTitle || '',
    summary: doc.summary || '',
    rawContent: doc.rawContent || '',
    markdownContent: doc.markdownContent || '',
    createTime: doc.createTime,
    tokenUsage: doc.tokenUsage ?? null,
    pinWeightType,
    aiNoteRecallId: null,
    tagId: doc.tagId ?? null,
    blocks: imagesToBlocks(doc.id, doc.images),
  }
}

function sortNotes(list) {
  const rank = { TOP: 0, DEFAULT: 1, BOTTOM: 2 }
  return list.slice().sort((a, b) => {
    const pinDiff =
      (rank[pinWeightToType(a.pinWeight)] ?? 1) -
      (rank[pinWeightToType(b.pinWeight)] ?? 1)
    if (pinDiff !== 0) return pinDiff
    return String(b.createTime || '').localeCompare(String(a.createTime || ''))
  })
}

function paginate(list, pageNo, pageSize) {
  const safePageNo = Math.max(1, Math.floor(pageNo) || 1)
  const safePageSize = Math.min(Math.max(Math.floor(pageSize) || NOTE_LIST_PAGE_SIZE, 1), 50)
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / safePageSize))
  const start = (safePageNo - 1) * safePageSize
  const records = list.slice(start, start + safePageSize)
  return {
    records,
    total,
    size: safePageSize,
    current: safePageNo,
    pages,
  }
}

function buildInsertResponse(doc) {
  return {
    id: doc.id,
    title: doc.title || '',
    tagId: doc.tagId ?? null,
    content: doc.markdownContent || doc.rawContent || '',
    blocks: imagesToBlocks(doc.id, doc.images),
  }
}

async function getNoteDoc(id) {
  const doc = stripNoteDoc(await dbGet(noteDocId(id)))
  if (!doc?.id) return null
  return doc
}

async function saveNoteDoc(doc) {
  const payload = { ...doc, _id: noteDocId(doc.id) }
  const result = await dbPut(payload)
  if (result?.rev) doc._rev = result.rev
  return doc
}

function countNotesByTagId(notes = []) {
  const map = new Map()
  notes.forEach((doc) => {
    if (!doc?.tagId) return
    const key = String(doc.tagId)
    map.set(key, (map.get(key) || 0) + 1)
  })
  return map
}

async function createNoteDoc(
  rawContent,
  images = [],
  { onProgress, tagId: inputTagId = null, tagName: inputTagName = '' } = {},
) {
  const id = createId()
  const now = formatDateTime()
  const text = String(rawContent ?? '')

  let tagId = inputTagId || null
  let tagName = String(inputTagName ?? '').trim()

  if (!tagId && tagName) {
    const tag = await resolveTagForTitle(tagName)
    tagId = tag.tagId
    tagName = tag.tagName
  }

  const doc = {
    id,
    rawContent: text,
    markdownContent: text,
    title: tagName,
    fineTitle: '',
    summary: '',
    createTime: now,
    updateTime: now,
    pinWeight: pinTypeToWeight('DEFAULT'),
    tagId,
    deletedAt: null,
    images: [],
  }

  if (images?.length) {
    doc.images = await saveImageFiles(id, images, { onProgress })
  } else if (typeof onProgress === 'function') {
    onProgress(1)
  }

  await saveNoteDoc(doc)
  return doc
}

export async function listByDay({ date, tagId = null, pageNo = 1, pageSize = NOTE_LIST_PAGE_SIZE }) {
  const all = await loadAllNoteDocs()
  let filtered = all

  if (date) {
    filtered = filtered.filter((doc) => datePartFromDateTime(doc.createTime) === date)
  }

  if (tagId === UNTAGGED_TAG_ID) {
    filtered = filtered.filter((doc) => !doc?.tagId)
  } else if (tagId != null && tagId !== '') {
    const targetTagId = String(tagId)
    filtered = filtered.filter((doc) => String(doc.tagId || '') === targetTagId)
  }

  const page = paginate(sortNotes(filtered), pageNo, pageSize)
  return {
    records: page.records.map(toApiNote),
    total: page.total,
    size: page.size,
    current: page.current,
    pages: page.pages,
  }
}

function noteCharCount(doc) {
  const text = doc?.markdownContent || doc?.rawContent || doc?.summary || ''
  return text.replace(/\s/g, '').length
}

export async function buildWritingDailyStats() {
  const all = await loadAllNoteDocs()
  const wordsByDate = {}
  const fragmentsByDate = {}

  all.forEach((doc) => {
    const key = datePartFromDateTime(doc.createTime)
    if (!key) return
    fragmentsByDate[key] = (fragmentsByDate[key] || 0) + 1
    wordsByDate[key] = (wordsByDate[key] || 0) + noteCharCount(doc)
  })

  return { wordsByDate, fragmentsByDate }
}

export async function insertNote(rawContent, images = [], onProgress, options = {}) {
  const doc = await createNoteDoc(rawContent, images, { onProgress, ...options })
  return buildInsertResponse(doc)
}

export async function updateNote(
  id,
  title,
  content,
  {
    retainedImageIds,
    newImages = [],
    onProgress,
    tagId: inputTagId = undefined,
    tagName: inputTagName = undefined,
  } = {},
) {
  const doc = await getNoteDoc(id)
  if (!doc || doc.deletedAt) {
    throw new Error('笔记不存在')
  }

  const nextContent = content ?? doc.markdownContent ?? doc.rawContent ?? ''
  let images = Array.isArray(doc.images) ? [...doc.images] : []

  if (Array.isArray(retainedImageIds)) {
    const keep = new Set(retainedImageIds.map(String))
    const removed = images.filter((img) => !keep.has(String(img.id)))
    await removeAttachments(removed)
    images = images.filter((img) => keep.has(String(img.id)))
  }

  if (newImages?.length) {
    const startOrder = images.length
    const added = await saveImageFiles(id, newImages, { onProgress })
    images = [
      ...images,
      ...added.map((item, index) => ({ ...item, sortOrder: startOrder + index })),
    ]
  } else if (typeof onProgress === 'function') {
    onProgress(1)
  }

  let tag
  if (inputTagId !== undefined || inputTagName !== undefined) {
    const nextTagId = inputTagId || null
    const nextTagName = String(inputTagName ?? '').trim()
    if (nextTagId) {
      tag = { tagId: nextTagId, tagName: nextTagName }
    } else if (nextTagName) {
      tag = await resolveTagForTitle(nextTagName)
    } else {
      tag = { tagId: null, tagName: '' }
    }
  } else {
    const nextTitle = title ?? doc.title
    tag = await resolveTagForTitle(nextTitle)
  }

  doc.title = tag.tagName || ''
  doc.tagId = tag.tagId
  doc.rawContent = nextContent
  doc.markdownContent = nextContent
  doc.summary = doc.summary || ''
  doc.updateTime = formatDateTime()
  doc.images = images

  await saveNoteDoc(doc)
  return buildInsertResponse(doc)
}

export async function deleteNoteToRecycle(id) {
  const doc = await getNoteDoc(id)
  if (!doc) return false
  doc.deletedAt = formatDateTime()
  doc.updateTime = formatDateTime()
  await saveNoteDoc(doc)
  return true
}

export async function setPin(id, pinWeightValue) {
  const doc = await getNoteDoc(id)
  if (!doc || doc.deletedAt) throw new Error('笔记不存在')
  doc.pinWeight = pinTypeToWeight(pinWeightValue)
  doc.updateTime = formatDateTime()
  await saveNoteDoc(doc)
  return { id: doc.id, pinWeightType: pinWeightToType(doc.pinWeight) }
}

export async function search(keyword, page = 1, pageSize = NOTE_LIST_PAGE_SIZE) {
  const q = String(keyword ?? '').trim().toLowerCase()
  const all = await loadAllNoteDocs()
  const matched = sortNotes(
    all.filter((doc) => {
      if (!q) return true
      const haystack = [
        doc.title,
        doc.summary,
        doc.rawContent,
        doc.markdownContent,
      ]
        .filter(Boolean)
        .join('\n')
        .toLowerCase()
      return haystack.includes(q)
    }),
  )
  const result = paginate(matched, page, pageSize)
  return {
    records: result.records.map(toApiNote),
    total: result.total,
    size: result.size,
    current: result.current,
    pages: result.pages,
  }
}

export async function listRecycle() {
  const docs = await dbAllDocs(NOTE_PREFIX)
  return (docs || [])
    .map(stripNoteDoc)
    .filter((doc) => doc?.id && doc.deletedAt)
    .sort((a, b) => String(b.deletedAt || '').localeCompare(String(a.deletedAt || '')))
    .map((doc) => ({
      ...toApiNote(doc),
      deletedAt: doc.deletedAt,
      recycleType: 'fragment',
    }))
}

export async function restoreRecycle(id) {
  const doc = await getNoteDoc(id)
  if (!doc) return false
  doc.deletedAt = null
  doc.updateTime = formatDateTime()
  await saveNoteDoc(doc)
  return true
}

export async function deleteForever(ids) {
  const idList = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String)
  for (const id of idList) {
    const doc = await getNoteDoc(id)
    if (!doc) continue
    revokeNoteAttachmentUrls(id, doc.images)
    await removeAttachments(doc.images)
    await dbRemove(noteDocId(id))
  }
  return true
}

export async function allTags() {
  const docs = await loadAllNoteDocs()
  const nameByTagId = new Map()
  docs.forEach((doc) => {
    if (!doc?.tagId || !doc?.title) return
    nameByTagId.set(String(doc.tagId), doc.title)
  })
  return listTagsWithCounts(countNotesByTagId(docs), nameByTagId)
}

export async function countUntaggedNotes() {
  const docs = await loadAllNoteDocs()
  return docs.filter((doc) => !doc?.tagId).length
}

export { createTag } from './tagRepository'

export async function updateTag(tagId, tagName) {
  const id = String(tagId ?? '').trim()
  if (!id) throw new Error('标签不存在')

  const notes = await loadAllNoteDocs({ includeDeleted: true })
  const matched = notes.filter((note) => String(note.tagId) === id)

  let tag
  const existing = await getTagById(id)
  if (existing) {
    tag = await updateTagDoc(id, tagName)
  } else if (matched.length) {
    const name = String(tagName ?? '').trim()
    if (!name) throw new Error('标签名称不能为空')
    if (!isTagNameWithinLimit(name)) {
      throw new Error(`标签名称不能超过 ${TAG_NAME_MAX_UNITS} 个字`)
    }
    const duplicate = await findTagByName(name)
    if (duplicate && String(duplicate.id) !== id) {
      throw new Error('标签名称已存在')
    }
    tag = { id, tagName: name }
  } else {
    throw new Error('标签不存在')
  }

  const now = formatDateTime()
  await Promise.all(
    matched.map(async (note) => {
      note.title = tag.tagName
      note.updateTime = now
      await saveNoteDoc(note)
    }),
  )
  return {
    tagId: tag.id,
    tagName: tag.tagName,
  }
}

export async function deleteTag(tagId) {
  const id = String(tagId ?? '').trim()
  if (!id) throw new Error('标签不存在')

  const notes = await loadAllNoteDocs({ includeDeleted: true })
  const matched = notes.filter((note) => String(note.tagId) === id)

  const existing = await getTagById(id)
  if (existing) {
    await removeTagDoc(id)
  } else if (!matched.length) {
    throw new Error('标签不存在')
  }

  const now = formatDateTime()
  await Promise.all(
    matched.map(async (note) => {
      note.tagId = null
      note.title = ''
      note.updateTime = now
      await saveNoteDoc(note)
    }),
  )
  return true
}

export async function localSemanticSearch(query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return []
  const all = await loadAllNoteDocs()
  const scored = all
    .map((doc) => {
      const fields = [doc.title, doc.summary, doc.rawContent, doc.markdownContent]
      const text = fields.filter(Boolean).join('\n').toLowerCase()
      if (!text.includes(q)) return null
      const similarity = text.startsWith(q) ? 0.95 : 0.8
      return {
        ...toApiNote(doc),
        similarity,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 12)

  return scored.map((item) => ({
    id: item.id,
    title: item.title || '',
    summary: item.summary || '',
    markdownContent: item.markdownContent || '',
    createTime: item.createTime,
    similarity: item.similarity,
    blocks: item.blocks ?? null,
  }))
}

export async function getNotesByIds(ids = []) {
  const idList = (Array.isArray(ids) ? ids : []).filter(Boolean).map(String)
  if (!idList.length) return []
  const docs = await loadAllNoteDocs({ includeArchived: true })
  const byId = new Map(docs.map((doc) => [String(doc.id), doc]))
  return idList
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map(toApiNote)
}

export async function archiveFragmentsForStructNote(fragmentIds, structNoteId) {
  const idList = (Array.isArray(fragmentIds) ? fragmentIds : []).filter(Boolean).map(String)
  if (!idList.length) return []
  const now = formatDateTime()
  const archivedIds = []
  for (const id of idList) {
    const doc = await getNoteDoc(id)
    if (!doc || doc.deletedAt || doc.archivedAt) continue
    if (!doc.archivedCreateTime && doc.createTime) {
      doc.archivedCreateTime = doc.createTime
    }
    doc.archivedAt = now
    doc.archivedByStructNoteId = String(structNoteId)
    doc.updateTime = now
    await saveNoteDoc(doc)
    archivedIds.push(doc.id)
  }
  return archivedIds
}

function unarchiveNoteDoc(doc) {
  const preservedCreateTime = doc.archivedCreateTime || doc.createTime
  delete doc.archivedAt
  delete doc.archivedByStructNoteId
  delete doc.archivedCreateTime
  if (preservedCreateTime) {
    doc.createTime = preservedCreateTime
  }
  doc.updateTime = formatDateTime()
}

export async function restoreFragmentsArchivedByStructNote(structNoteId) {
  const targetId = String(structNoteId ?? '').trim()
  if (!targetId) return []
  const docs = await dbAllDocs(NOTE_PREFIX)
  const restoredIds = []
  for (const raw of docs || []) {
    const doc = stripNoteDoc(raw)
    if (!doc?.id || doc.deletedAt || !doc.archivedAt) continue
    if (String(doc.archivedByStructNoteId ?? '') !== targetId) continue
    unarchiveNoteDoc(doc)
    await saveNoteDoc(doc)
    restoredIds.push(doc.id)
  }
  return restoredIds
}

export async function restoreFragmentFromArchive(fragmentId) {
  const id = String(fragmentId ?? '').trim()
  if (!id) throw new Error('碎片不存在')
  const doc = await getNoteDoc(id)
  if (!doc || doc.deletedAt) throw new Error('碎片不存在')
  if (!doc.archivedAt) return toApiNote(doc)

  unarchiveNoteDoc(doc)
  await saveNoteDoc(doc)
  return toApiNote(doc)
}

export async function moveToSediment(ids, parentId = 0) {
  const idList = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String)
  const archivedIds = []
  for (const id of idList) {
    const doc = await getNoteDoc(id)
    if (!doc || doc.deletedAt || doc.archivedAt) continue
    const structNoteId = await createNoteInFolder({
      parentId,
      title: doc.title || autoTitleFromContent(doc.rawContent),
      content: doc.markdownContent || doc.rawContent || '',
      sourceFragmentIds: [id],
    })
    const archived = await archiveFragmentsForStructNote([id], structNoteId)
    archivedIds.push(...archived)
  }
  return archivedIds
}
