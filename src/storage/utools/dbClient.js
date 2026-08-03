import { ApiError } from '../../api/http'

function getDb() {
  if (!window.utools?.db) {
    throw new ApiError('UTOOLS_DB', 'uTools 本地数据库不可用')
  }
  return window.utools.db
}

function wrapResult(result, action) {
  if (result?.error) {
    const rawMessage = result.message || `${action}失败`
    if (/attachment data up to 10/i.test(rawMessage)) {
      throw new ApiError('FILE_TOO_LARGE', '单个附件不能超过 10MB')
    }
    throw new ApiError(result.name || 'DB_ERROR', rawMessage)
  }
  return result
}

function isConflictResult(result) {
  const text = `${result?.name || ''} ${result?.message || ''}`.toLowerCase()
  return result?.error && text.includes('conflict')
}

/**
 * uTools 更新文档必须带最新 _rev，否则报 Document update conflict。
 * 保存前丢弃调用方传入的旧 _rev，始终从库中读取；冲突时最多重试 3 次。
 */
export async function dbPut(doc) {
  const db = getDb()
  const run = db.promises?.put ?? ((d) => Promise.resolve(db.put(d)))

  if (!doc?._id) {
    throw new ApiError('DB_ERROR', '文档缺少 _id')
  }

  const attempt = async () => {
    const payload = { ...doc }
    delete payload._rev
    const existing = await dbGet(payload._id)
    if (existing?._rev && !existing?.error) {
      payload._rev = existing._rev
    }
    return run(payload)
  }

  let result = await attempt()
  let retries = 0
  while (isConflictResult(result) && retries < 3) {
    retries += 1
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

function postAttachmentOnce(db, id, attachment, type) {
  let result = db.postAttachment(id, attachment, type)
  // 个别 MIME（如 OpenXML 长类型）会被 uTools 参数校验拒绝，回退通用类型再试
  if (result?.error && /params\s*"type"/i.test(result.message || '')) {
    if (type !== 'application/octet-stream') {
      result = db.postAttachment(id, attachment, 'application/octet-stream')
    }
  }
  return result
}

function removeAttachmentDocSync(db, id) {
  try {
    const existing = db.get(id)
    if (!existing || existing.error) return
    db.remove(existing)
  } catch {
    /* 附件可能已不存在 */
  }
}

/**
 * 同 id 附件已存在时 postAttachment 会报 Document update conflict。
 * 冲突则删旧再写；导入/覆盖场景常见。
 */
export function dbPostAttachment(id, attachment, type) {
  const db = getDb()
  let result = postAttachmentOnce(db, id, attachment, type)
  if (isConflictResult(result)) {
    removeAttachmentDocSync(db, id)
    result = postAttachmentOnce(db, id, attachment, type)
  }
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
