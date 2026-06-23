import { getAttachmentBlobUrl } from '../storage/utools/attachment'
import { ATTACHMENT_PREFIX } from '../storage/utools/constants'
import { isUtoolsMode } from '../storage/env'

export const LB_ATT_SCHEME = 'lb-att://'

const blobToAttachmentId = new Map()

export function buildAttachmentRef(noteId, imageId) {
  return `${ATTACHMENT_PREFIX}${noteId}/${imageId}`
}

export function toAttachmentMarkdownRef(noteId, imageId) {
  return `${LB_ATT_SCHEME}${encodeURIComponent(buildAttachmentRef(noteId, imageId))}`
}

function resolveAttachmentRef(ref) {
  if (!ref.startsWith(LB_ATT_SCHEME)) return ref
  const attachmentId = decodeURIComponent(ref.slice(LB_ATT_SCHEME.length))
  if (!attachmentId) return ref
  const blob = getAttachmentBlobUrl(attachmentId)
  if (blob) {
    blobToAttachmentId.set(blob, attachmentId)
    return blob
  }
  return ref
}

const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\((lb-att:\/\/[^)]+)\)/g

export function resolveAttachmentRefsInMarkdown(markdown) {
  const text = String(markdown ?? '')
  if (!text.includes(LB_ATT_SCHEME)) return text
  return text.replace(IMAGE_MARKDOWN_RE, (match, alt, ref) => {
    const resolved = resolveAttachmentRef(ref)
    return `![${alt}](${resolved})`
  })
}

export function persistAttachmentRefsInMarkdown(markdown) {
  let text = String(markdown ?? '')
  if (!text || !blobToAttachmentId.size) return text
  for (const [blob, attachmentId] of blobToAttachmentId) {
    if (!text.includes(blob)) continue
    const ref = `${LB_ATT_SCHEME}${encodeURIComponent(attachmentId)}`
    text = text.split(blob).join(ref)
  }
  return text
}

export function buildFragmentImageMarkdown(note) {
  const images = Array.isArray(note?.images) ? note.images : []
  const noteId = note?.id
  if (!images.length) return ''

  return images
    .map((img, idx) => {
      const label = `图片${idx + 1}`
      if (noteId && img?.id && isUtoolsMode()) {
        return `![${label}](${toAttachmentMarkdownRef(noteId, img.id)})`
      }
      const url = img?.url || ''
      return url ? `![${label}](${url})` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}
