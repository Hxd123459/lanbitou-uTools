import { isImageMimeType } from '../constants/uploadLimits'

export function getAttachmentKind(item) {
  if (!item) return 'file'
  if (item.kind === 'image' || item.kind === 'file') return item.kind
  if (item.type === 'image' || item.type === 'file') return item.type
  const mime = item.mimeType || item.mime || ''
  return isImageMimeType(mime) ? 'image' : 'file'
}

export function getAttachmentName(item, fallback = '附件') {
  return (
    item?.name ||
    item?.fileName ||
    item?.file?.name ||
    fallback
  )
}

export function splitAttachments(list = []) {
  const attachments = Array.isArray(list) ? list : []
  const images = []
  const files = []
  attachments.forEach((item) => {
    if (getAttachmentKind(item) === 'image') images.push(item)
    else files.push(item)
  })
  return { attachments, images, files }
}

export function formatFileSize(bytes) {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function getFileExtension(name = '') {
  const match = String(name).match(/\.([^.]+)$/)
  return match ? match[1].toUpperCase() : 'FILE'
}

export function truncateFileName(name = '', max = 18) {
  const text = String(name)
  if (text.length <= max) return text
  const extMatch = text.match(/(\.[^.]+)$/)
  const ext = extMatch ? extMatch[1] : ''
  const baseMax = Math.max(6, max - ext.length - 1)
  return `${text.slice(0, baseMax)}…${ext}`
}
