import { ApiError } from '../../api/http'

function getDb() {
  if (!window.utools?.db) {
    throw new ApiError('UTOOLS_DB', 'uTools 本地数据库不可用')
  }
  return window.utools.db
}

function wrapResult(result, action) {
  if (result?.error) {
    throw new ApiError(result.name || 'DB_ERROR', result.message || `${action}失败`)
  }
  return result
}

export async function dbPut(doc) {
  const db = getDb()
  const run = db.promises?.put ?? ((d) => Promise.resolve(db.put(d)))
  return wrapResult(await run(doc), '保存')
}

export async function dbGet(id) {
  const db = getDb()
  const run = db.promises?.get ?? ((i) => Promise.resolve(db.get(i)))
  return run(id)
}

export async function dbRemove(docOrId) {
  const db = getDb()
  const run = db.promises?.remove ?? ((d) => Promise.resolve(db.remove(d)))
  return wrapResult(await run(docOrId), '删除')
}

export async function dbAllDocs(prefix) {
  const db = getDb()
  const run = db.promises?.allDocs ?? ((p) => Promise.resolve(db.allDocs(p)))
  return run(prefix)
}

export function dbPostAttachment(id, attachment, type) {
  const db = getDb()
  const result = db.postAttachment(id, attachment, type)
  return wrapResult(result, '保存附件')
}

export function dbGetAttachment(id) {
  return getDb().getAttachment(id)
}

export function dbGetAttachmentType(id) {
  return getDb().getAttachmentType(id)
}
