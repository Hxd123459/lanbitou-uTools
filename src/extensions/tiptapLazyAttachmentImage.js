import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { getAttachmentBlobUrl } from '../storage/utools/attachment'
import {
  LB_ATT_SCHEME,
  registerAttachmentBlobUrl,
} from '../utils/attachmentMarkdown'

const PLACEHOLDER_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="72" viewBox="0 0 120 72"><rect width="120" height="72" rx="6" fill="%23ece8e1"/><rect x="36" y="22" width="48" height="28" rx="4" fill="%23d9d2c5"/></svg>',
  )

function isLbAttSrc(src) {
  return typeof src === 'string' && src.startsWith(LB_ATT_SCHEME)
}

function scheduleIdle(fn) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(() => fn(), { timeout: 180 })
  }
  return setTimeout(fn, 0)
}

function resolveLbAttToBlob(src) {
  if (!isLbAttSrc(src)) return src || ''
  try {
    const attachmentId = decodeURIComponent(src.slice(LB_ATT_SCHEME.length))
    if (!attachmentId) return ''
    const blob = getAttachmentBlobUrl(attachmentId)
    if (blob) {
      registerAttachmentBlobUrl(blob, attachmentId)
      return blob
    }
  } catch {
    // ignore malformed ref
  }
  return ''
}

/**
 * 图片 NodeView：lb-att:// 进入视口后再读附件，避免长文打开时同步解压全部图片。
 */
export const LazyAttachmentImage = Image.extend({
  name: 'image',

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const img = document.createElement('img')
      const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        src: undefined,
      })
      Object.entries(attrs).forEach(([key, value]) => {
        if (value == null || key === 'src') return
        img.setAttribute(key, String(value))
      })
      img.alt = node.attrs.alt || ''
      img.draggable = false

      let currentSrc = node.attrs.src || ''
      let destroyed = false
      let io = null
      let idleId = null

      const clearIdle = () => {
        if (idleId == null) return
        if (typeof cancelIdleCallback === 'function' && typeof idleId === 'number') {
          try {
            cancelIdleCallback(idleId)
          } catch {
            clearTimeout(idleId)
          }
        } else {
          clearTimeout(idleId)
        }
        idleId = null
      }

      const applyResolved = (url) => {
        if (destroyed || !url) return
        img.src = url
        img.classList.remove('tiptap-image--pending')
      }

      const loadSrc = (src) => {
        clearIdle()
        if (!isLbAttSrc(src)) {
          applyResolved(src)
          return
        }
        img.classList.add('tiptap-image--pending')
        if (!img.getAttribute('src')) {
          img.src = PLACEHOLDER_SRC
        }
        idleId = scheduleIdle(() => {
          idleId = null
          applyResolved(resolveLbAttToBlob(src))
        })
      }

      const observeOrLoad = (src) => {
        io?.disconnect()
        io = null
        if (!isLbAttSrc(src) || typeof IntersectionObserver === 'undefined') {
          loadSrc(src)
          return
        }
        img.classList.add('tiptap-image--pending')
        img.src = PLACEHOLDER_SRC
        io = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return
            io?.disconnect()
            io = null
            loadSrc(src)
          },
          { root: null, rootMargin: '280px 0px', threshold: 0.01 },
        )
        io.observe(img)
      }

      observeOrLoad(currentSrc)

      return {
        dom: img,
        update(updatedNode) {
          if (updatedNode.type.name !== 'image') return false
          img.alt = updatedNode.attrs.alt || ''
          const nextSrc = updatedNode.attrs.src || ''
          if (nextSrc !== currentSrc) {
            currentSrc = nextSrc
            observeOrLoad(currentSrc)
          }
          return true
        },
        destroy() {
          destroyed = true
          clearIdle()
          io?.disconnect()
          io = null
        },
      }
    }
  },
})
