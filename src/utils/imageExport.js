/** 单张图片嵌入 Markdown 的上限（压缩后） */
export const MAX_EMBED_IMAGE_BYTES = 150 * 1024

/** 剪贴板 Markdown 文本总上限 */
export const MAX_CLIPBOARD_MD_BYTES = 900 * 1024

const MAX_IMAGE_DIMENSION = 1280
const JPEG_QUALITY = 0.82

export async function compressImageBlob(
  blob,
  {
    maxWidth = MAX_IMAGE_DIMENSION,
    maxHeight = MAX_IMAGE_DIMENSION,
    quality = JPEG_QUALITY,
    maxBytes = MAX_EMBED_IMAGE_BYTES,
  } = {},
) {
  if (!blob?.type?.startsWith('image/')) return blob

  const bitmap = await createImageBitmap(blob)
  let { width, height } = bitmap
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return blob
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const tryTypes =
    blob.type === 'image/png' || blob.type === 'image/webp'
      ? ['image/jpeg', 'image/png']
      : ['image/jpeg']

  for (const type of tryTypes) {
    const compressed = await canvasToBlob(canvas, type, quality)
    if (compressed && compressed.size <= maxBytes) return compressed
    if (compressed && type === 'image/jpeg') {
      const smaller = await canvasToBlob(canvas, type, Math.max(0.5, quality - 0.2))
      if (smaller && smaller.size <= maxBytes) return smaller
    }
  }

  const fallback = await canvasToBlob(canvas, 'image/jpeg', 0.65)
  return fallback || blob
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

/** 剪贴板 image/* 写入通常仅支持 PNG，统一转换 */
export async function blobToClipboardPng(blob) {
  if (!blob?.type?.startsWith('image/')) return blob
  if (blob.type === 'image/png') return blob

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return blob
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close?.()

  const png = await canvasToBlob(canvas, 'image/png')
  return png || blob
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function blobToEmbeddableDataUrl(blob, options = {}) {
  const compressed = await compressImageBlob(blob, options)
  if (compressed.size > (options.maxBytes ?? MAX_EMBED_IMAGE_BYTES)) {
    return null
  }
  return blobToDataUrl(compressed)
}

export function utf8ByteLength(text) {
  return new TextEncoder().encode(String(text ?? '')).length
}
