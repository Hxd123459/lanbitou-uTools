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
  const data = await get(`/struct/folder/list/${parentId}`)
  return Array.isArray(data) ? data.map(mapStructItem) : []
}

export async function createStructFolder({ parentId = 0, name }) {
  return post('/struct/folder/createFolder', { parentId, name })
}

export async function createNoteInFolder({ parentId = 0, title, content, tagId = null }) {
  const body = { parentId, title, content }
  if (tagId != null) body.tagId = tagId
  return post('/struct/folder/createNoteInFolder', body)
}

export async function renameStructItem({ id, name }) {
  return post('/struct/folder/rename', { id, name })
}

export async function moveStructItem({ id, targetParentId }) {
  return post('/struct/folder/move', { id, targetParentId })
}

export async function deleteStructItem(id) {
  return get(`/struct/folder/delete/${id}`)
}
