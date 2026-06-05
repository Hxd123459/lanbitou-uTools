import { STRUCT_FOLDER_PREFIX, STRUCT_NOTE_PREFIX } from './constants'
import { dbAllDocs, dbGet, dbPut, dbRemove } from './dbClient'
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
    .filter((doc) => doc?.id && parentIdMatches(doc.parentId, parentId))
    .sort((a, b) => {
      const sortDiff = (a.sort ?? 0) - (b.sort ?? 0)
      if (sortDiff !== 0) return sortDiff
      return String(b.createTime || '').localeCompare(String(a.createTime || ''))
    })
    .map(toFolderItem)
}

export async function createFolder({ parentId = 0, name }) {
  const id = createId()
  const now = formatDateTime()
  const doc = {
    id,
    parentId: normalizeParentId(parentId),
    name: String(name ?? '').trim() || '未命名文件夹',
    type: 'folder',
    noteId: null,
    sort: 0,
    createTime: now,
    updateTime: now,
  }
  await saveDoc(STRUCT_FOLDER_PREFIX, doc)
  return id
}

export async function createStructNote({ title, content, tagId = null }) {
  const id = createId()
  const now = formatDateTime()
  const doc = {
    id,
    title: String(title ?? '').trim() || '无标题',
    content: String(content ?? ''),
    tagId: tagId ?? null,
    createTime: now,
    updateTime: now,
  }
  await saveDoc(STRUCT_NOTE_PREFIX, doc)
  return id
}

export async function createNoteInFolder({ parentId = 0, title, content, tagId = null }) {
  const noteId = await createStructNote({ title, content, tagId })
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

export async function moveItem({ id, targetParentId }) {
  const doc = stripDoc(await dbGet(folderDocId(id)))
  if (!doc) return false
  doc.parentId = normalizeParentId(targetParentId)
  doc.updateTime = formatDateTime()
  await saveDoc(STRUCT_FOLDER_PREFIX, doc)
  return true
}

async function deleteFolderChildren(parentId) {
  const children = await listFolder(parentId ?? 0)
  for (const child of children) {
    if (child.type === 'folder') {
      await deleteFolderChildren(child.id)
    } else if (child.type === 'note' && child.noteId) {
      await deleteStructNote(child.noteId)
    }
    await dbRemove(folderDocId(child.id))
  }
}

export async function deleteItem(id) {
  const doc = stripDoc(await dbGet(folderDocId(id)))
  if (!doc) return false
  if (doc.type === 'folder') {
    await deleteFolderChildren(doc.id)
  } else if (doc.type === 'note' && doc.noteId) {
    await deleteStructNote(doc.noteId)
  }
  await dbRemove(folderDocId(id))
  return true
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

export async function getStructNote(id) {
  const doc = stripDoc(await dbGet(structNoteDocId(id)))
  if (!doc) return null
  return {
    id: doc.id,
    title: doc.title || '',
    content: doc.content || '',
    tagId: doc.tagId ?? null,
    createTime: doc.createTime,
    updateTime: doc.updateTime,
  }
}

export async function updateStructNote({ id, title, content, tagId = null }) {
  const doc = stripDoc(await dbGet(structNoteDocId(id)))
  if (!doc) throw new Error('结构化笔记不存在')
  doc.title = String(title ?? '').trim() || '无标题'
  doc.content = String(content ?? '')
  if (tagId != null) doc.tagId = tagId
  doc.updateTime = formatDateTime()
  await saveDoc(STRUCT_NOTE_PREFIX, doc)

  const folderDocs = await dbAllDocs(STRUCT_FOLDER_PREFIX)
  const linked = (folderDocs || [])
    .map(stripDoc)
    .find((item) => item?.type === 'note' && String(item.noteId) === String(id))
  if (linked && linked.name !== doc.title) {
    linked.name = doc.title
    linked.updateTime = formatDateTime()
    await saveDoc(STRUCT_FOLDER_PREFIX, linked)
  }

  return doc.id
}

export async function deleteStructNote(id) {
  const doc = stripDoc(await dbGet(structNoteDocId(id)))
  if (!doc) return false
  await dbRemove(structNoteDocId(id))
  return true
}
