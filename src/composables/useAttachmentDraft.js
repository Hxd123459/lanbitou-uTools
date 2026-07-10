import { ref } from 'vue'
import {
  MAX_ATTACHMENTS,
  isAttachmentFileSizeAllowed,
  isImageFile,
  isImageFileSizeAllowed,
} from '../constants/uploadLimits'
import { formatFileSize } from '../utils/attachmentDisplay'

export function useAttachmentDraft({ maxCount = MAX_ATTACHMENTS } = {}) {
  const items = ref([])

  const createKey = () =>
    `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const toStripItem = (item) => ({
    key: item.key,
    kind: item.kind,
    name: item.name,
    previewUrl: item.previewUrl,
    url: item.url,
    sizeLabel: item.file ? formatFileSize(item.file.size) : '',
  })

  const stripItems = () => items.value.map(toStripItem)

  const remaining = () => Math.max(0, maxCount - items.value.length)

  const appendFiles = (files = []) => {
    const list = Array.from(files).filter(Boolean)
    if (!list.length) return { accepted: 0, tooBig: 0, limitExceeded: false }

    const tooBig = list.filter((file) => {
      if (isImageFile(file)) return !isImageFileSizeAllowed(file)
      return !isAttachmentFileSizeAllowed(file)
    })
    const ok = list.filter((file) => {
      if (isImageFile(file)) return isImageFileSizeAllowed(file)
      return isAttachmentFileSizeAllowed(file)
    })

    const slot = remaining()
    if (slot <= 0) {
      return {
        accepted: 0,
        tooBig: tooBig.length,
        limitExceeded: true,
        imageTooLarge: tooBig.some(isImageFile),
        fileTooLarge: tooBig.some((file) => !isImageFile(file)),
      }
    }

    const accepted = ok.slice(0, slot)
    accepted.forEach((file) => {
      const kind = isImageFile(file) ? 'image' : 'file'
      items.value.push({
        key: createKey(),
        kind,
        name: file.name || (kind === 'image' ? '图片' : '附件'),
        file,
        existingId: null,
        url: '',
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : '',
      })
    })

    return {
      accepted: accepted.length,
      tooBig: tooBig.length,
      limitExceeded: ok.length > slot,
      imageTooLarge: tooBig.some(isImageFile),
      fileTooLarge: tooBig.some((file) => !isImageFile(file)),
    }
  }

  const removeItem = (key) => {
    const idx = items.value.findIndex((item) => item.key === key)
    if (idx === -1) return
    const item = items.value[idx]
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    items.value.splice(idx, 1)
  }

  const resetItems = () => {
    items.value.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    })
    items.value = []
  }

  const cloneFromNoteAttachments = (attachments = []) =>
    (Array.isArray(attachments) ? attachments : []).map((item, idx) => ({
      key: `ex_${item.id ?? `n${idx}`}`,
      kind: item.kind === 'file' ? 'file' : 'image',
      name: item.name || item.fileName || (item.kind === 'file' ? '附件' : '图片'),
      existingId: item.id ?? null,
      url: item.url || '',
      file: null,
      previewUrl: null,
    }))

  const getNewFiles = () => items.value.filter((item) => item.file).map((item) => item.file)

  const getRetainedIds = () =>
    items.value.filter((item) => item.existingId != null).map((item) => item.existingId)

  const payloadChanged = (originalIds = []) => {
    const draftExisting = getRetainedIds()
    const orig = originalIds.filter((id) => id != null)
    if (draftExisting.length !== orig.length) return true
    for (let i = 0; i < orig.length; i += 1) {
      if (String(draftExisting[i]) !== String(orig[i])) return true
    }
    return items.value.some((item) => item.file)
  }

  return {
    items,
    stripItems,
    remaining,
    appendFiles,
    removeItem,
    resetItems,
    cloneFromNoteAttachments,
    getNewFiles,
    getRetainedIds,
    payloadChanged,
  }
}
