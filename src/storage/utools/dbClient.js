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

function isConflictResult(result) {
  const text = `${result?.name || ''} ${result?.message || ''}`.toLowerCase()
  return result?.error && text.includes('conflict')
}

/**
 * uTools 更新文档必须带最新 _rev，否则报 Document update conflict。
 * 保存前始终从库中读取 _rev；冲突时重试一次。
 */
export async function dbPut(doc) {
  const db = getDb()
  const run = db.promises?.put ?? ((d) => Promise.resolve(db.put(d)))

  if (!doc?._id) {
    throw new ApiError('DB_ERROR', '文档缺少 _id')
  }

  const attempt = async () => {
    const payload = { ...doc }
    const existing = await dbGet(payload._id)
    if (existing?._rev) {
      payload._rev = existing._rev
    }
    return run(payload)
  }

  let result = await attempt()
  if (isConflictResult(result)) {
    result = await attempt()
  }

  return wrapResult(result, '保存')
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

export async function dbGetAttachmentAsync(id) {
  const db = getDb()
  if (db.promises?.getAttachment) {
    return db.promises.getAttachment(id)
  }
  return db.getAttachment(id)
}

export function dbGetAttachmentType(id) {
  return getDb().getAttachmentType(id)
}

export async function dbGetAttachmentTypeAsync(id) {
  const db = getDb()
  if (db.promises?.getAttachmentType) {
    return db.promises.getAttachmentType(id)
  }
  return db.getAttachmentType(id)
}
