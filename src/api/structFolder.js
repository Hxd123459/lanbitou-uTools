import { isUtoolsMode } from '../storage/env'
import * as utoolsStruct from '../storage/utools/structRepository'
import { get, post } from './http'

function mapStructItem(item) {
  return {
    id: item.id,
    parentId: item.parentId ?? null,
    name: item.name || '',
    type: item.type || 'folder',
    noteId: item.noteId ?? null,
    sort: item.sort ?? 0,
    createTime: item.createTime,
    updateTime: item.updateTime,
  }
}

export async function fetchFolderList(parentId = 0) {
  if (isUtoolsMode()) {
    const data = await utoolsStruct.listFolder(parentId)
    return Array.isArray(data) ? data.map(mapStructItem) : []
  }
  const data = await get(`/struct/folder/list/${parentId}`)
  return Array.isArray(data) ? data.map(mapStructItem) : []
}

export async function createStructFolder({ parentId = 0, name }) {
  if (isUtoolsMode()) {
    return utoolsStruct.createFolder({ parentId, name })
  }
  return post('/struct/folder/createFolder', { parentId, name })
}

export async function createNoteInFolder({ parentId = 0, title, content, tagId = null }) {
  const body = { parentId, title, content }
  if (tagId != null) body.tagId = tagId
  if (isUtoolsMode()) {
    return utoolsStruct.createNoteInFolder(body)
  }
  return post('/struct/folder/createNoteInFolder', body)
}

export async function renameStructItem({ id, name }) {
  if (isUtoolsMode()) {
    return utoolsStruct.renameItem({ id, name })
  }
  return post('/struct/folder/rename', { id, name })
}

export async function moveStructItem({ id, targetParentId }) {
  if (isUtoolsMode()) {
    return utoolsStruct.moveItem({ id, targetParentId })
  }
  return post('/struct/folder/move', { id, targetParentId })
}

export async function deleteStructItem(id) {
  if (isUtoolsMode()) {
    return utoolsStruct.deleteItem(id)
  }
  return get(`/struct/folder/delete/${id}`)
}

export async function updateStructSort(list) {
  if (isUtoolsMode()) {
    return utoolsStruct.updateSort(list)
  }
  return post('/struct/folder/updateSort', list)
}
