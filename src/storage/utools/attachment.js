import { isImageMimeType } from '../../constants/uploadLimits'
import { ATTACHMENT_PREFIX } from './constants'
import { dbGetAttachment, dbGetAttachmentType, dbPostAttachment, dbRemove } from './dbClient'
import { createId, detectMimeType, fileToUint8Array } from './utils'

const urlCache = new Map()

export function buildAttachmentId(noteId, imageId) {
  return `${ATTACHMENT_PREFIX}${noteId}/${imageId}`
}

export function revokeAttachmentUrl(attachmentId) {
  const cached = urlCache.get(attachmentId)
  if (cached) {
    URL.revokeObjectURL(cached)
    urlCache.delete(attachmentId)
  }
}

export function revokeNoteAttachmentUrls(noteId, images = []) {
  images.forEach((img) => {
    if (img?.attachmentId) revokeAttachmentUrl(img.attachmentId)
    else if (img?.id) revokeAttachmentUrl(buildAttachmentId(noteId, img.id))
  })
}

export function getAttachmentBlobUrl(attachmentId) {
  if (!attachmentId) return ''
  const cached = urlCache.get(attachmentId)
  if (cached) return cached

  const buf = dbGetAttachment(attachmentId)
  if (!buf) return ''

  const type = dbGetAttachmentType(attachmentId) || 'image/png'
  const url = URL.createObjectURL(new Blob([buf], { type }))
  urlCache.set(attachmentId, url)
  return url
}

export async function saveImageFiles(noteId, files = [], { onProgress } = {}) {
  const list = Array.isArray(files) ? files.filter(Boolean) : []
  if (!list.length) return []

  const saved = []
  for (let index = 0; index < list.length; index += 1) {
    const file = list[index]
    const imageId = createId()
    const attachmentId = buildAttachmentId(noteId, imageId)
    const mimeType = detectMimeType(file, index)
    const bytes = await fileToUint8Array(file)
    dbPostAttachment(attachmentId, bytes, mimeType)
    saved.push({
      id: imageId,
      attachmentId,
      mimeType,
      fileName: file.name || `附件${index + 1}`,
      sortOrder: index,
    })
    if (typeof onProgress === 'function') {
      onProgress((index + 1) / list.length)
    }
  }
  return saved
}

export async function removeAttachments(images = []) {
  for (const img of images) {
    if (!img?.attachmentId) continue
    revokeAttachmentUrl(img.attachmentId)
    try {
      await dbRemove(img.attachmentId)
    } catch {
      // 附件可能已不存在，忽略
    }
  }
}

export function imagesToBlocks(noteId, images = []) {
  return (images || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((img) => {
      const mimeType = img.mimeType || 'application/octet-stream'
      return {
        id: img.id,
        type: isImageMimeType(mimeType) ? 'image' : 'file',
        fileName: img.fileName || '',
        mimeType,
        fileUrl: getAttachmentBlobUrl(img.attachmentId || buildAttachmentId(noteId, img.id)),
        sortOrder: img.sortOrder ?? 0,
      }
    })
}
