import { isUtoolsMode } from '../storage/env'
import * as utoolsStruct from '../storage/utools/structRepository'
import { get, post } from './http'

export async function createStructNote({ title, content, tagId = null }) {
  const body = { title, content }
  if (tagId != null) body.tagId = tagId
  if (isUtoolsMode()) {
    return utoolsStruct.createStructNote(body)
  }
  return post('/struct/note/create', body)
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
  const body = { id, title, content }
  if (tagId != null) body.tagId = tagId
  if (sourceFragmentIds !== undefined) body.sourceFragmentIds = sourceFragmentIds
  if (introducedFragmentIds !== undefined) body.introducedFragmentIds = introducedFragmentIds
  if (introducedFragmentMethods !== undefined) body.introducedFragmentMethods = introducedFragmentMethods
  if (isUtoolsMode()) {
    return utoolsStruct.updateStructNote(body)
  }
  return post('/struct/note/update', body)
}

export async function deleteStructNote(id) {
  if (isUtoolsMode()) {
    return utoolsStruct.deleteStructNote(id)
  }
  return get(`/struct/note/delete/${id}`)
}

export async function getStructNote(id) {
  if (isUtoolsMode()) {
    return utoolsStruct.getStructNote(id)
  }
  return get(`/struct/note/get/${id}`)
}

export async function findStructFolderItemByNoteId(noteId) {
  if (isUtoolsMode()) {
    return utoolsStruct.findFolderItemByNoteId(noteId)
  }
  return null
}
