import { get, post } from './http'

export async function createStructNote({ title, content, tagId = null }) {
  const body = { title, content }
  if (tagId != null) body.tagId = tagId
  return post('/struct/note/create', body)
}

export async function updateStructNote({ id, title, content, tagId = null }) {
  const body = { id, title, content }
  if (tagId != null) body.tagId = tagId
  return post('/struct/note/update', body)
}

export async function deleteStructNote(id) {
  return get(`/struct/note/delete/${id}`)
}

export async function getStructNote(id) {
  return get(`/struct/note/get/${id}`)
}
