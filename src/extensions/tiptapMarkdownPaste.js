import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

function hasRichClipboardHtml(html) {
  if (!html?.trim()) return false

  const stripped = html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .trim()

  return /<(p|h[1-6]|ul|ol|li|strong|em|b|i|u|del|s|blockquote|pre|code|table|thead|tbody|tr|td|th)(\s|>)/i.test(
    stripped,
  )
}

function clipboardHasImages(clipboardData) {
  return Array.from(clipboardData.items || []).some(
    (item) => item.kind === 'file' && item.type.startsWith('image/'),
  )
}

export const MarkdownPasteExtension = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const clipboardData = event.clipboardData
            if (!clipboardData) return false
            if (clipboardHasImages(clipboardData)) return false

            const plain = clipboardData.getData('text/plain')
            if (!plain) return false

            const html = clipboardData.getData('text/html')
            if (hasRichClipboardHtml(html)) return false

            event.preventDefault()
            return editor.commands.insertContent(plain, { contentType: 'markdown' })
          },
        },
      }),
    ]
  },
})
