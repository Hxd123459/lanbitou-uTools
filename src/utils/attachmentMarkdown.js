import { getAttachmentBlobUrl, saveImageFiles } from '../storage/utools/attachment'
import { ATTACHMENT_PREFIX } from '../storage/utools/constants'
import { isUtoolsMode } from '../storage/env'

export const LB_ATT_SCHEME = 'lb-att://'

const blobToAttachmentId = new Map()
const blobToPendingFile = new Map()

export function registerAttachmentBlobUrl(blobUrl, attachmentId) {
  if (blobUrl && attachmentId) {
    blobToAttachmentId.set(blobUrl, attachmentId)
  }
}

export function registerPendingBlobUrl(blobUrl, file) {
  if (blobUrl && file) {
    blobToPendingFile.set(blobUrl, file)
  }
}

export function hasPendingInlineImages(markdown) {
  const text = String(markdown ?? '')
  for (const blob of blobToPendingFile.keys()) {
    if (text.includes(blob)) return true
  }
  return false
}

export async function finalizeInlineImagesInMarkdown(noteId, markdown) {
  let text = persistAttachmentRefsInMarkdown(markdown)
  if (!noteId || !isUtoolsMode() || !blobToPendingFile.size) return text

  for (const [blob, file] of [...blobToPendingFile.entries()]) {
    if (!text.includes(blob)) continue
    const saved = await saveImageFiles(noteId, [file])
    if (!saved.length) continue
    const ref = `${LB_ATT_SCHEME}${encodeURIComponent(saved[0].attachmentId)}`
    text = text.split(blob).join(ref)
    blobToPendingFile.delete(blob)
    URL.revokeObjectURL(blob)
  }

  return text
}

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

export function extractLbAttRefsFromMarkdown(markdown) {
  const refs = []
  const seen = new Set()
  const text = String(markdown ?? '')
  if (!text.includes(LB_ATT_SCHEME)) return refs

  const re = /lb-att:\/\/([^)\s"']+)/g
  let match = re.exec(text)
  while (match) {
    try {
      const attachmentId = decodeURIComponent(match[1])
      if (attachmentId && !seen.has(attachmentId)) {
        seen.add(attachmentId)
        refs.push(attachmentId)
      }
    } catch {
      // ignore malformed ref
    }
    match = re.exec(text)
  }
  return refs
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
