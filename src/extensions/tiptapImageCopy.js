import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { persistAttachmentRefsInMarkdown } from '../utils/attachmentMarkdown'
import { copyMarkdownWithImages } from '../utils/copyNoteContent'

function selectionContainsImage(state) {
  const { from, to, empty, node } = state.selection
  if (empty) return node?.type?.name === 'image'

  let found = false
  state.doc.nodesBetween(from, to, (current) => {
    if (current.type.name === 'image') {
      found = true
      return false
    }
    return undefined
  })
  return found
}

function getSelectionMarkdown(editor) {
  const { state } = editor
  const { selection } = state
  let slice

  if (selection.empty) {
    if (selection.node?.type?.name !== 'image') return ''
    slice = selection.content()
  } else {
    slice = state.doc.slice(selection.from, selection.to)
  }

  const content = []
  slice.content.forEach((node) => {
    content.push(node.toJSON())
  })
  if (!content.length) return ''

  const manager = editor.markdown
  if (!manager?.serialize) return ''
  return persistAttachmentRefsInMarkdown(
    manager.serialize({ type: 'doc', content }),
  )
}

async function copySelectionWithImages(editor) {
  const markdown = getSelectionMarkdown(editor)
  if (!markdown.trim()) return null
  return copyMarkdownWithImages(markdown)
}

export function createImageCopyExtension(getContext) {
  return Extension.create({
    name: 'imageCopy',

    addProseMirrorPlugins() {
      const editor = this.editor

      const handleClipboard = (event, { cut = false } = {}) => {
        if (!selectionContainsImage(editor.state)) return false

        event.preventDefault()
        const ctx = getContext?.() || {}
        void (async () => {
          try {
            const result = await copySelectionWithImages(editor)
            if (!result) return
            ctx.onCopied?.(result)
            if (cut) {
              editor.commands.deleteSelection()
            }
          } catch (error) {
            console.warn('[tiptapImageCopy] copy failed:', error)
            ctx.onCopyFailed?.(error)
          }
        })()

        return true
      }

      return [
        new Plugin({
          props: {
            handleDOMEvents: {
              copy: (_view, event) => handleClipboard(event),
              cut: (_view, event) => handleClipboard(event, { cut: true }),
            },
          },
        }),
      ]
    },
  })
}
