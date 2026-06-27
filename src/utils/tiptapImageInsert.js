import { isImageFileSizeAllowed } from '../constants/uploadLimits'
import { isUtoolsMode } from '../storage/env'
import { getAttachmentBlobUrl, saveImageFiles } from '../storage/utools/attachment'
import {
  registerAttachmentBlobUrl,
  registerPendingBlobUrl,
} from './attachmentMarkdown'

function dataUrlToFile(dataUrl, index = 0) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const [, mime, base64] = match
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const ext = mime.split('/')[1]?.split('+')[0] || 'png'
  return new File([bytes], `pasted-image-${index + 1}.${ext}`, { type: mime })
}

export function extractImagesFromHtml(html) {
  if (!html || !html.includes('<img')) return []
  const files = []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('img[src]').forEach((img, index) => {
      const src = img.getAttribute('src')?.trim()
      if (!src?.startsWith('data:image/')) return
      const file = dataUrlToFile(src, index)
      if (file) files.push(file)
    })
  } catch {
    // ignore malformed html
  }
  return files
}

export function extractClipboardImageFiles(clipboardData) {
  const fromFiles = Array.from(clipboardData?.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)

  if (fromFiles.length) return fromFiles

  const html = clipboardData?.getData('text/html')
  return extractImagesFromHtml(html)
}

export function insertTextAtTextareaCursor(textarea, currentText, text, onUpdate) {
  if (!textarea || !text) return
  const start = textarea.selectionStart ?? currentText.length
  const end = textarea.selectionEnd ?? start
  const next = `${currentText.slice(0, start)}${text}${currentText.slice(end)}`
  onUpdate(next)
  const pos = start + text.length
  queueMicrotask(() => {
    textarea.setSelectionRange(pos, pos)
  })
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
