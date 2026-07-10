/** 单张图片体积上限（字节）；允许范围为严格小于该值（小于 10 MiB） */
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024

/** 单个附件体积上限（字节）；允许范围为严格小于该值（小于 10 MiB，与 uTools / 后端一致） */
export const MAX_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024

/** 单条笔记最多附件数（图片 + 文件合计） */
export const MAX_ATTACHMENTS = 20

export function isImageFileSizeAllowed(file) {
  return file && typeof file.size === 'number' && file.size < MAX_IMAGE_FILE_BYTES
}

export function isAttachmentFileSizeAllowed(file) {
  return file && typeof file.size === 'number' && file.size < MAX_ATTACHMENT_FILE_BYTES
}

export function isImageMimeType(mime = '') {
  return String(mime).toLowerCase().startsWith('image/')
}

export function isImageFile(file) {
  if (!file) return false
  return isImageMimeType(file.type) || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name || '')
}
