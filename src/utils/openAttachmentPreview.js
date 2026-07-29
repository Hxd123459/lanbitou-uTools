import { isUtoolsMode } from '../storage/env'

const PREVIEW_TIP_SEEN_KEY = 'lanbitou/attachment-preview-tip-seen'

function getStorage() {
  if (typeof window === 'undefined') return null
  if (window.utools?.dbStorage) return window.utools.dbStorage
  try {
    return {
      getItem: (key) => {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      },
      setItem: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value))
      },
    }
  } catch {
    return null
  }
}

export function hasSeenAttachmentPreviewTip() {
  const storage = getStorage()
  return Boolean(storage?.getItem(PREVIEW_TIP_SEEN_KEY))
}

export function markAttachmentPreviewTipSeen() {
  const storage = getStorage()
  storage?.setItem(PREVIEW_TIP_SEEN_KEY, true)
}

function getAttachmentService() {
  return window.services?.attachment || null
}

async function bytesFromAttachment(item) {
  if (!item) return null

  if (item.file instanceof Blob) {
    return new Uint8Array(await item.file.arrayBuffer())
  }

  const url = item.url || item.fileUrl || ''
  if (url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('读取附件失败')
    return new Uint8Array(await res.arrayBuffer())
  }

  return null
}

function triggerBrowserDownload(bytes, item) {
  const name = item?.name || item?.fileName || '附件'
  const blob = new Blob([bytes], {
    type: item?.mimeType || item?.mime || 'application/octet-stream',
  })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

/** 下载附件到本地 */
export async function downloadAttachment(item) {
  const name = item?.name || item?.fileName || '附件'
  const bytes = await bytesFromAttachment(item)
  if (!bytes?.length) throw new Error('附件内容为空')
  triggerBrowserDownload(bytes, { ...item, name })
  return { ok: true }
}

/**
 * 跳转「文件预览」插件预览附件。
 * @see https://www.u-tools.cn/docs/developer/utools-api/window.html
 */
export async function openAttachmentInFilePreview(item) {
  const name = item?.name || item?.fileName || '附件'
  const bytes = await bytesFromAttachment(item)
  if (!bytes?.length) throw new Error('附件内容为空')

  if (isUtoolsMode()) {
    const svc = getAttachmentService()
    if (!svc?.openInFilePreview) {
      throw new Error('当前环境不支持文件预览跳转')
    }
    const result = svc.openInFilePreview(name, bytes)
    if (!result?.ok) {
      throw new Error(result?.error || '跳转文件预览失败')
    }
    return result
  }

  triggerBrowserDownload(bytes, { ...item, name })
  return { ok: true, path: '' }
}
