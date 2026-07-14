import {
  DragHandlePlugin,
  defaultComputePositionConfig,
  dragHandlePluginDefaultKey,
  normalizeNestedOptions,
} from '@tiptap/extension-drag-handle'

const DRAG_HANDLE_NESTED = { edgeDetection: { threshold: -16 } }
const DRAG_HANDLE_POSITION = { placement: 'left-start', strategy: 'fixed' }

/** 靠近滚动容器边缘多少 px 开始自动滚动（对齐社区 GlobalDragHandle 的 scrollTreshold 思路） */
const DRAG_SCROLL_EDGE = 96
const DRAG_SCROLL_MAX_SPEED = 22

function buildUnifiedVirtualElement(editor, pos) {
  const dom = editor.view.nodeDOM(pos)
  if (!(dom instanceof HTMLElement)) return null

  const editorRect = editor.view.dom.getBoundingClientRect()
  const blockRect = dom.getBoundingClientRect()

  return {
    getBoundingClientRect: () => ({
      width: 0,
      height: blockRect.height,
      top: blockRect.top,
      left: editorRect.left,
      right: editorRect.left,
      bottom: blockRect.bottom,
      x: editorRect.left,
      y: blockRect.top,
    }),
  }
}

function getDragScrollContainer(editor) {
  return (
    editor.view.dom.closest('.struct-note-editor-column') ||
    editor.view.dom.closest('.struct-note-md-editor') ||
    null
  )
}

/**
 * 拖拽段落时在滚动容器边缘自动滚动。
 * 官方 @tiptap/extension-drag-handle 无此能力；
 * 社区 tiptap-extension-global-drag-handle 用 window.scroll，
 * 这里改滚编辑区自身的 overflow 容器。
 */
function createDragAutoScroll(editor) {
  let active = false
  let hasPointer = false
  let pointerY = 0
  let rafId = 0

  const onDragOver = (event) => {
    if (!active) return
    // dragover 比 drag 更稳：Chrome 下 drag 在源外常给 clientY=0
    if (event.clientY === 0 && event.clientX === 0) return
    hasPointer = true
    pointerY = event.clientY
  }

  const tick = () => {
    if (!active) return

    const container = hasPointer ? getDragScrollContainer(editor) : null
    if (container) {
      const rect = container.getBoundingClientRect()
      const topZone = rect.top + DRAG_SCROLL_EDGE
      const bottomZone = rect.bottom - DRAG_SCROLL_EDGE

      if (pointerY < topZone && container.scrollTop > 0) {
        const intensity = Math.min(1, (topZone - pointerY) / DRAG_SCROLL_EDGE)
        container.scrollTop -= Math.max(2, DRAG_SCROLL_MAX_SPEED * intensity)
      } else if (
        pointerY > bottomZone &&
        container.scrollTop < container.scrollHeight - container.clientHeight
      ) {
        const intensity = Math.min(1, (pointerY - bottomZone) / DRAG_SCROLL_EDGE)
        container.scrollTop += Math.max(2, DRAG_SCROLL_MAX_SPEED * intensity)
      }
    }

    rafId = requestAnimationFrame(tick)
  }

  return {
    start() {
      if (active) return
      active = true
      hasPointer = false
      pointerY = 0
      document.addEventListener('dragover', onDragOver, { passive: true })
      rafId = requestAnimationFrame(tick)
    },
    stop() {
      if (!active) return
      active = false
      hasPointer = false
      document.removeEventListener('dragover', onDragOver)
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    },
  }
}

export function mountStructNoteDragHandle(editor, element) {
  let activePos = -1
  const autoScroll = createDragAutoScroll(editor)

  const api = DragHandlePlugin({
    pluginKey: dragHandlePluginDefaultKey,
    editor,
    element,
    computePositionConfig: {
      ...defaultComputePositionConfig,
      ...DRAG_HANDLE_POSITION,
    },
    nestedOptions: normalizeNestedOptions(DRAG_HANDLE_NESTED),
    onNodeChange: ({ node, pos }) => {
      activePos = node ? pos : -1
    },
    getReferencedVirtualElement: () => {
      if (activePos === -1) return null
      return buildUnifiedVirtualElement(editor, activePos)
    },
    onElementDragStart: () => {
      autoScroll.start()
    },
    onElementDragEnd: () => {
      autoScroll.stop()
    },
  })

  api.stopAutoScroll = autoScroll.stop
  editor.registerPlugin(api.plugin)
  return api
}

export function unmountStructNoteDragHandle(editor, api) {
  if (!api) return
  api.stopAutoScroll?.()
  if (editor && !editor.isDestroyed) {
    editor.unregisterPlugin(dragHandlePluginDefaultKey)
  }
  api.unbind?.()
}
