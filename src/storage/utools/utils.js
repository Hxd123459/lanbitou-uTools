export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function formatDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function datePartFromDateTime(dateTime) {
  if (!dateTime) return ''
  return String(dateTime).slice(0, 10)
}

export function autoTitleFromContent(content) {
  const text = String(content ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return '无标题'
  return text.length > 20 ? `${text.slice(0, 20)}…` : text
}

export function normalizeParentId(parentId) {
  if (parentId == null || parentId === '' || parentId === 0 || parentId === '0') {
    return null
  }
  return String(parentId)
}

export function parentIdMatches(docParentId, queryParentId) {
  const normalized = normalizeParentId(queryParentId)
  const docParent = docParentId == null || docParentId === '' ? null : String(docParentId)
  return docParent === normalized
}

export async function fileToUint8Array(file) {
  const buffer = await file.arrayBuffer()
  return new Uint8Array(buffer)
}

export function detectMimeType(file, index = 0) {
  if (file?.type) return file.type
  const name = file?.name || ''
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg'
  if (/\.png$/i.test(name)) return 'image/png'
  if (/\.webp$/i.test(name)) return 'image/webp'
  if (/\.gif$/i.test(name)) return 'image/gif'
  if (/\.pdf$/i.test(name)) return 'application/pdf'
  if (/\.docx?$/i.test(name)) return 'application/msword'
  if (/\.xlsx?$/i.test(name)) return 'application/vnd.ms-excel'
  if (/\.pptx?$/i.test(name)) return 'application/vnd.ms-powerpoint'
  if (/\.zip$/i.test(name)) return 'application/zip'
  if (/\.txt$/i.test(name)) return 'text/plain'
  if (/\.md$/i.test(name)) return 'text/markdown'
  return 'application/octet-stream'
}
