/** 单张图片体积上限（字节）；允许范围为严格小于该值（小于 10 MiB） */
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024

export function isImageFileSizeAllowed(file) {
  return file && typeof file.size === 'number' && file.size < MAX_IMAGE_FILE_BYTES
}
