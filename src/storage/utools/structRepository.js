import { STRUCT_FOLDER_PREFIX, STRUCT_NOTE_PREFIX } from './constants'
import { dbAllDocs, dbGet, dbPut, dbRemove } from './dbClient'
import { restoreFragmentsArchivedByStructNote, restoreFragmentFromArchive } from './noteRepository'
import { createId, formatDateTime, normalizeParentId, parentIdMatches } from './utils'

function folderDocId(id) {
  return `${STRUCT_FOLDER_PREFIX}${id}`
}

function structNoteDocId(id) {
  return `${STRUCT_NOTE_PREFIX}${id}`
}

function stripDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

async function saveDoc(idPrefix, data) {
  const payload = { ...data, _id: `${idPrefix}${data.id}` }
  const result = await dbPut(payload)
  if (result?.rev) data._rev = result.rev
  return data
}

function toFolderItem(doc) {
  return {
    id: doc.id,
    parentId: doc.parentId ?? null,
    name: doc.name || '',
    type: doc.type || 'folder',
    noteId: doc.noteId ?? null,
    sort: doc.sort ?? 0,
    createTime: doc.createTime,
    updateTime: doc.updateTime,
  }
}

export async function listFolder(parentId = 0) {
  const docs = await dbAllDocs(STRUCT_FOLDER_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && !doc.deletedAt && parentIdMatches(doc.parentId, parentId))
    .sort((a, b) => {
      const sortDiff = (a.sort ?? 0) - (b.sort ?? 0)
      if (sortDiff !== 0) return sortDiff
      return String(b.createTime || '').localeCompare(String(a.createTime || ''))
    })
    .map(toFolderItem)
}

export async function createFolder({ parentId = 0, name, sort } = {}) {
  const id = createId()
  const now = formatDateTime()
  const parent = normalizeParentId(parentId)
  // 最多两级嵌套：父路径长度已达 2 则禁止再建
  if (parent) {
    const parentStack = await getFolderPathStack(parent)
    if (parentStack.length >= 2) {
      throw new Error('文件夹最多支持两级嵌套')
    }
  }
  let sortValue = 0
  if (sort === 'append') {
    const siblings = await listFolder(parent ?? 0)
    sortValue = siblings.reduce((max, item) => Math.max(max, item.sort ?? 0), -1) + 1
  } else if (typeof sort === 'number' && Number.isFinite(sort)) {
    sortValue = sort
  }
  const doc = {
    id,
    parentId: parent,
    name: String(name ?? '').trim() || '未命名文件夹',
    type: 'folder',
    noteId: null,
    sort: sortValue,
    createTime: now,
    updateTime: now,
  }
  await saveDoc(STRUCT_FOLDER_PREFIX, doc)
  return id
}

export async function createStructNote({
  title,
  content,
  tagId = null,
  sourceFragmentIds = null,
}) {
  const id = createId()
  const now = formatDateTime()
  const doc = {
    id,
    title: String(title ?? '').trim() || '无标题',
    content: String(content ?? ''),
    tagId: tagId ?? null,
    sourceFragmentIds: normalizeSourceFragmentIds(sourceFragmentIds),
    introducedFragmentIds: [],
    createTime: now,
    updateTime: now,
  }
  await saveDoc(STRUCT_NOTE_PREFIX, doc)
  return id
}

function normalizeSourceFragmentIds(ids) {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.filter(Boolean).map(String))]
}

function normalizeIntroducedFragmentIds(ids) {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.filter(Boolean).map(String))]
}

export async function createNoteInFolder({
  parentId = 0,
  title,
  content,
  tagId = null,
  sourceFragmentIds = null,
}) {
  const noteId = await createStructNote({ title, content, tagId, sourceFragmentIds })
  const folderItemId = createId()
  const now = formatDateTime()
  const folderDoc = {
    id: folderItemId,
    parentId: normalizeParentId(parentId),
    name: String(title ?? '').trim() || '无标题',
    type: 'note',
    noteId,
    sort: 0,
    createTime: now,
    updateTime: now,
  }
  await saveDoc(STRUCT_FOLDER_PREFIX, folderDoc)
  return noteId
}

export async function renameItem({ id, name }) {
  const doc = stripDoc(await dbGet(folderDocId(id)))
  if (!doc) return false
  doc.name = String(name ?? '').trim()
  doc.updateTime = formatDateTime()
  await saveDoc(STRUCT_FOLDER_PREFIX, doc)
  return true
}

export async function getFolderItem(id) {
  const targetId = String(id ?? '').trim()
  if (!targetId) return null
  const doc = stripDoc(await dbGet(folderDocId(targetId)))
  if (!doc || doc.deletedAt) return null
  return toFolderItem(doc)
}

export async function moveItem({ id, targetParentId }) {
  const doc = stripDoc(await dbGet(folderDocId(id)))
  if (!doc) return false
  doc.parentId = normalizeParentId(targetParentId)
  doc.updateTime = formatDateTime()
  await saveDoc(STRUCT_FOLDER_PREFIX, doc)
  return true
}

async function softDeleteFolderItem(folderItem) {
  if (!folderItem?.id) return false
  const doc = stripDoc(await dbGet(folderDocId(folderItem.id)))
  if (!doc || doc.deletedAt) return false
  const now = formatDateTime()
  doc.deletedAt = now
  doc.updateTime = now
  await saveDoc(STRUCT_FOLDER_PREFIX, doc)
  return true
}

async function deleteFolderChildren(parentId) {
  const children = await listFolder(parentId ?? 0)
  for (const child of children) {
    if (child.type === 'folder') {
      await deleteFolderChildren(child.id)
      await softDeleteFolderItem(child)
      continue
    }
    if (child.type === 'note' && child.noteId) {
      const folderDoc = stripDoc(await dbGet(folderDocId(child.id)))
      await deleteStructNote(child.noteId, { folderItem: folderDoc || child })
      await softDeleteFolderItem(folderDoc || child)
    }
  }
}

export async function deleteItem(id) {
  const doc = stripDoc(await dbGet(folderDocId(id)))
  if (!doc || doc.deletedAt) return false
  if (doc.type === 'folder') {
    await deleteFolderChildren(doc.id)
  } else if (doc.type === 'note' && doc.noteId) {
    await deleteStructNote(doc.noteId, { folderItem: doc })
  }
  return softDeleteFolderItem(doc)
}

export async function updateSort(list = []) {
  for (const item of list) {
    if (!item?.id) continue
    const doc = stripDoc(await dbGet(folderDocId(item.id)))
    if (!doc) continue
    doc.sort = Number(item.sort) || 0
    doc.updateTime = formatDateTime()
    await saveDoc(STRUCT_FOLDER_PREFIX, doc)
  }
  return true
}

function normalizeIntroducedFragmentMethods(methods) {
  if (!methods || typeof methods !== 'object' || Array.isArray(methods)) return {}
  const out = {}
  for (const [id, method] of Object.entries(methods)) {
    const fragmentId = String(id ?? '').trim()
    const value = String(method ?? '').trim()
    if (fragmentId && value) out[fragmentId] = value
  }
  return out
}

export async function getStructNote(id) {
  const doc = stripDoc(await dbGet(structNoteDocId(id)))
  if (!doc || doc.deletedAt) return null
  return {
    id: doc.id,
    title: doc.title || '',
    content: doc.content || '',
    tagId: doc.tagId ?? null,
    sourceFragmentIds: normalizeSourceFragmentIds(doc.sourceFragmentIds),
    introducedFragmentIds:
      doc.introducedFragmentIds === undefined
        ? undefined
        : normalizeIntroducedFragmentIds(doc.introducedFragmentIds),
    introducedFragmentMethods:
      doc.introducedFragmentMethods === undefined
        ? undefined
        : normalizeIntroducedFragmentMethods(doc.introducedFragmentMethods),
    createTime: doc.createTime,
    updateTime: doc.updateTime,
  }
}

export async function removeSourceFragmentFromStructNote(structNoteId, fragmentId) {
  const id = String(structNoteId ?? '').trim()
  const fragment = String(fragmentId ?? '').trim()
  if (!id || !fragment) return false
  const doc = stripDoc(await dbGet(structNoteDocId(id)))
  if (!doc) return false
  const next = normalizeSourceFragmentIds(doc.sourceFragmentIds).filter(
    (item) => item !== fragment,
  )
  doc.sourceFragmentIds = next
  doc.updateTime = formatDateTime()
  await saveDoc(STRUCT_NOTE_PREFIX, doc)
  return true
}

export async function getFolderPathStack(parentId = 0) {
  let currentId = normalizeParentId(parentId)
  if (!currentId) return []

  const docs = (await dbAllDocs(STRUCT_FOLDER_PREFIX) || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && !doc.deletedAt)
  const byId = new Map(docs.map((doc) => [String(doc.id), doc]))

  const stack = []
  const guard = new Set()

  while (currentId && !guard.has(String(currentId))) {
    guard.add(String(currentId))
    const folder = byId.get(String(currentId))
    if (!folder || folder.type !== 'folder') break
    stack.unshift({ id: folder.id, name: folder.name || '未命名文件夹' })
    currentId = normalizeParentId(folder.parentId)
  }

  return stack
}

export async function findFolderItemByNoteId(noteId) {
  const targetId = String(noteId ?? '').trim()
  if (!targetId) return null
  const docs = await dbAllDocs(STRUCT_FOLDER_PREFIX)
  const doc = (docs || [])
    .map(stripDoc)
    .find(
      (item) =>
        item?.type === 'note'
        && !item.deletedAt
        && String(item.noteId) === targetId,
    )
  return doc ? toFolderItem(doc) : null
}

export async function updateStructNote({
  id,
  title,
  content,
  tagId = null,
  sourceFragmentIds = undefined,
  introducedFragmentIds = undefined,
  introducedFragmentMethods = undefined,
}) {
  const doc = stripDoc(await dbGet(structNoteDocId(id)))
  if (!doc || doc.deletedAt) throw new Error('结构化笔记不存在')
  doc.title = String(title ?? '').trim() || '无标题'
  doc.content = String(content ?? '')
  if (tagId != null) doc.tagId = tagId
  if (sourceFragmentIds !== undefined) {
    doc.sourceFragmentIds = normalizeSourceFragmentIds(sourceFragmentIds)
  }
  if (introducedFragmentIds !== undefined) {
    doc.introducedFragmentIds = normalizeIntroducedFragmentIds(introducedFragmentIds)
  }
  if (introducedFragmentMethods !== undefined) {
    doc.introducedFragmentMethods = normalizeIntroducedFragmentMethods(introducedFragmentMethods)
  }
  doc.updateTime = formatDateTime()
  await saveDoc(STRUCT_NOTE_PREFIX, doc)

  const folderDocs = await dbAllDocs(STRUCT_FOLDER_PREFIX)
  const linked = (folderDocs || [])
    .map(stripDoc)
    .find(
      (item) =>
        item?.type === 'note'
        && !item.deletedAt
        && String(item.noteId) === String(id),
    )
  if (linked && linked.name !== doc.title) {
    linked.name = doc.title
    linked.updateTime = formatDateTime()
    await saveDoc(STRUCT_FOLDER_PREFIX, linked)
  }

  return doc.id
}

export async function deleteStructNote(id, { folderItem = null } = {}) {
  const doc = stripDoc(await dbGet(structNoteDocId(id)))
  if (!doc || doc.deletedAt) return false

  await restoreFragmentsArchivedByStructNote(id)
  const fragmentIdsToRestore = new Set([
    ...normalizeSourceFragmentIds(doc.sourceFragmentIds),
    ...normalizeIntroducedFragmentIds(doc.introducedFragmentIds),
  ])
  for (const fragmentId of fragmentIdsToRestore) {
    try {
      await restoreFragmentFromArchive(fragmentId)
    } catch {
      /* 碎片可能已还原或不存在 */
    }
  }

  const now = formatDateTime()
  doc.deletedAt = now
  doc.updateTime = now
  if (folderItem) {
    doc.recycleFolderItem = {
      id: folderItem.id,
      parentId: folderItem.parentId ?? null,
      name: folderItem.name || doc.title || '',
      sort: folderItem.sort ?? 0,
    }
  }
  await saveDoc(STRUCT_NOTE_PREFIX, doc)
  return true
}

export async function listStructRecycle() {
  const docs = await dbAllDocs(STRUCT_NOTE_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && doc.deletedAt)
    .sort((a, b) => String(b.deletedAt || '').localeCompare(String(a.deletedAt || '')))
    .map((doc) => ({
      id: doc.id,
      recycleType: 'sediment',
      title: doc.title || '',
      content: doc.content || '',
      createTime: doc.createTime,
      deletedAt: doc.deletedAt,
    }))
}

export async function restoreStructRecycle(id) {
  const noteId = String(id ?? '').trim()
  if (!noteId) return false
  const doc = stripDoc(await dbGet(structNoteDocId(noteId)))
  if (!doc?.deletedAt) return false

  delete doc.deletedAt
  doc.updateTime = formatDateTime()
  const snapshot = doc.recycleFolderItem
  delete doc.recycleFolderItem
  await saveDoc(STRUCT_NOTE_PREFIX, doc)

  if (!snapshot?.id) return true

  const existing = stripDoc(await dbGet(folderDocId(snapshot.id)))
  if (existing) {
    delete existing.deletedAt
    existing.parentId = snapshot.parentId ?? null
    existing.name = snapshot.name || existing.name || doc.title || ''
    existing.noteId = noteId
    existing.type = 'note'
    existing.sort = snapshot.sort ?? existing.sort ?? 0
    existing.updateTime = formatDateTime()
    await saveDoc(STRUCT_FOLDER_PREFIX, existing)
    return true
  }

  const now = formatDateTime()
  await saveDoc(STRUCT_FOLDER_PREFIX, {
    id: snapshot.id,
    parentId: snapshot.parentId ?? null,
    name: snapshot.name || doc.title || '无标题',
    type: 'note',
    noteId,
    sort: snapshot.sort ?? 0,
    createTime: now,
    updateTime: now,
  })
  return true
}

export async function deleteStructForever(id) {
  const noteId = String(id ?? '').trim()
  if (!noteId) return false
  const doc = stripDoc(await dbGet(structNoteDocId(noteId)))
  if (!doc) return false
  const folderItemId = doc.recycleFolderItem?.id
  if (folderItemId) {
    try {
      await dbRemove(folderDocId(folderItemId))
    } catch {
      /* 目录项可能已不存在 */
    }
  }
  await dbRemove(structNoteDocId(noteId))
  return true
}
