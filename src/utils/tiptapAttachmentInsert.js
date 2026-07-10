import {
  isAttachmentFileSizeAllowed,
  isImageFile,
  isImageFileSizeAllowed,
} from '../constants/uploadLimits'
import { isUtoolsMode } from '../storage/env'
import { getAttachmentBlobUrl, saveImageFiles } from '../storage/utools/attachment'
import {
  registerAttachmentBlobUrl,
  registerPendingBlobUrl,
  toAttachmentMarkdownRef,
} from './attachmentMarkdown'

export async function prepareAttachmentForInsert(file, noteId) {
  if (!file) return { error: 'invalid' }

  const isImage = isImageFile(file)
  if (isImage && !isImageFileSizeAllowed(file)) {
    return { error: 'image-too-large' }
  }
  if (!isImage && !isAttachmentFileSizeAllowed(file)) {
    return { error: 'file-too-large' }
  }

  const label = file.name || (isImage ? '图片' : '附件')

  if (noteId && isUtoolsMode()) {
    const saved = await saveImageFiles(noteId, [file])
    if (!saved.length) return { error: 'save-failed' }
    const attachmentId = saved[0].attachmentId
    const blob = getAttachmentBlobUrl(attachmentId)
    registerAttachmentBlobUrl(blob, attachmentId)
    const ref = toAttachmentMarkdownRef(noteId, saved[0].id)
    if (isImage) {
      return { kind: 'image', src: blob, alt: label, ref }
    }
    return { kind: 'file', href: blob, label, ref }
  }

  const blob = URL.createObjectURL(file)
  registerPendingBlobUrl(blob, file)
  if (isImage) {
    return { kind: 'image', src: blob, alt: label }
  }
  return { kind: 'file', href: blob, label }
}

export function extractClipboardAttachmentFiles(clipboardData) {
  const items = Array.from(clipboardData?.items || [])
  const files = items
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean)
  return files
}
