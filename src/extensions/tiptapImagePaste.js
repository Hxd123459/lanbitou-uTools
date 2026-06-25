import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import {
  extractClipboardImageFiles,
  prepareImageSrcForInsert,
} from '../utils/tiptapImageInsert'
import { markClipboardImageHandledByPaste } from '../composables/useUtoolsClipboardEnter'

export function createImagePasteExtension(getContext) {
  return Extension.create({
    name: 'imagePaste',

    addProseMirrorPlugins() {
      const editor = this.editor

      return [
        new Plugin({
          props: {
            handlePaste(_view, event) {
              const files = extractClipboardImageFiles(event.clipboardData)
              if (!files.length) return false

              event.preventDefault()
              markClipboardImageHandledByPaste()
              const ctx = getContext?.() || {}

              void (async () => {
                for (const file of files) {
                  const result = await prepareImageSrcForInsert(file, ctx.noteId)
                  if (result.error === 'too-large') {
                    ctx.onImageTooLarge?.()
                    continue
                  }
                  if (result.error || !result.src) continue
                  editor.chain().focus().setImage({ src: result.src, alt: result.alt }).run()
                }
              })()

              return true
            },
          },
        }),
      ]
    },
  })
}
