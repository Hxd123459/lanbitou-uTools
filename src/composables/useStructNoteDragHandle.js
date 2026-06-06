import {
  DragHandlePlugin,
  defaultComputePositionConfig,
  dragHandlePluginDefaultKey,
  normalizeNestedOptions,
} from '@tiptap/extension-drag-handle'

const DRAG_HANDLE_NESTED = { edgeDetection: { threshold: -16 } }
const DRAG_HANDLE_POSITION = { placement: 'left-start', strategy: 'fixed' }

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

export function mountStructNoteDragHandle(editor, element) {
  let activePos = -1

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
  })

  editor.registerPlugin(api.plugin)
  return api
}

export function unmountStructNoteDragHandle(editor, api) {
  if (!api) return
  if (editor && !editor.isDestroyed) {
    editor.unregisterPlugin(dragHandlePluginDefaultKey)
  }
  api.unbind?.()
}
