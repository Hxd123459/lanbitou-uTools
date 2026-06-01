export function previewScrollSyncPlugin() {
  return {
    editorEffect({ editor, root }) {
      const preview = root.querySelector('.bytemd-preview')
      if (!preview) return undefined

      let syncing = false

      const syncFromEditor = () => {
        if (syncing) return
        syncing = true
        preview.scrollTop = editor.getScrollInfo().top
        syncing = false
      }

      const syncFromPreview = () => {
        if (syncing) return
        syncing = true
        editor.scrollTo(null, preview.scrollTop)
        syncing = false
      }

      const focusEditor = (event) => {
        event.preventDefault()
        editor.focus()
      }

      editor.on('scroll', syncFromEditor)
      preview.addEventListener('scroll', syncFromPreview, { passive: true })
      preview.addEventListener('mousedown', focusEditor)

      return () => {
        editor.off('scroll', syncFromEditor)
        preview.removeEventListener('scroll', syncFromPreview)
        preview.removeEventListener('mousedown', focusEditor)
      }
    },
  }
}
