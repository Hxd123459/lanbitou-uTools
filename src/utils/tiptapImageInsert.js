import { isImageFileSizeAllowed } from '../constants/uploadLimits'
import { isUtoolsMode } from '../storage/env'
import { getAttachmentBlobUrl, saveImageFiles } from '../storage/utools/attachment'
import {
  registerAttachmentBlobUrl,
  registerPendingBlobUrl,
} from './attachmentMarkdown'

export function extractClipboardImageFiles(clipboardData) {
  return Array.from(clipboardData?.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)
}

export async function prepareImageSrcForInsert(file, noteId) {
  if (!isImageFileSizeAllowed(file)) {
    return { error: 'too-large' }
  }

  if (noteId && isUtoolsMode()) {
    const saved = await saveImageFiles(noteId, [file])
    if (!saved.length) return { error: 'save-failed' }
    const attachmentId = saved[0].attachmentId
    const src = getAttachmentBlobUrl(attachmentId)
    registerAttachmentBlobUrl(src, attachmentId)
    return { src, alt: file.name || '图片' }
  }

  const src = URL.createObjectURL(file)
  registerPendingBlobUrl(src, file)
  return { src, alt: file.name || '图片' }
}
