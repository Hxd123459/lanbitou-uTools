import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { markClipboardImageHandledByPaste } from '../composables/useUtoolsClipboardEnter'
import { prepareAttachmentForInsert } from '../utils/tiptapAttachmentInsert'
import { extractClipboardPasteFiles } from '../utils/tiptapImageInsert'

export function createAttachmentPasteExtension(getContext) {
  return Extension.create({
    name: 'attachmentPaste',

    addProseMirrorPlugins() {
      const editor = this.editor

      return [
        new Plugin({
          props: {
            handlePaste(_view, event) {
              const files = extractClipboardPasteFiles(event.clipboardData)
              if (!files.length) return false

              event.preventDefault()
              markClipboardImageHandledByPaste()
              const ctx = getContext?.() || {}

              void (async () => {
                for (const file of files) {
                  const result = await prepareAttachmentForInsert(file, ctx.noteId)
                  if (result.error === 'image-too-large') {
                    ctx.onImageTooLarge?.()
                    continue
                  }
                  if (result.error === 'file-too-large') {
                    ctx.onFileTooLarge?.()
                    continue
                  }
                  if (result.error || !result.kind) continue

                  if (result.kind === 'image' && result.src) {
                    editor
                      .chain()
                      .focus()
                      .setImage({ src: result.src, alt: result.alt })
                      .run()
                    continue
                  }

                  if (result.kind === 'file' && result.href) {
                    editor
                      .chain()
                      .focus()
                      .insertContent({
                        type: 'text',
                        text: result.label,
                        marks: [
                          {
                            type: 'link',
                            attrs: {
                              href: result.href,
                              target: '_blank',
                              rel: 'noopener noreferrer',
                            },
                          },
                        ],
                      })
                      .insertContent(' ')
                      .run()
                  }
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
