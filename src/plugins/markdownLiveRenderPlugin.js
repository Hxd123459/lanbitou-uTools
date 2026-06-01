export function markdownLiveRenderPlugin() {
  return {
    editorEffect({ editor }) {
      const refreshLineStyles = () => {
        const lineCount = editor.lineCount()
        for (let line = 0; line < lineCount; line += 1) {
          const text = editor.getLine(line) || ''
          editor.removeLineClass(line, 'wrap', 'struct-note-md-task-line')
          editor.removeLineClass(line, 'wrap', 'struct-note-md-quote-line')
          editor.removeLineClass(line, 'wrap', 'struct-note-md-code-line')

          if (/^-\s+\[[ xX]\]/.test(text)) {
            editor.addLineClass(line, 'wrap', 'struct-note-md-task-line')
          } else if (/^>\s?/.test(text)) {
            editor.addLineClass(line, 'wrap', 'struct-note-md-quote-line')
          } else if (/^```/.test(text)) {
            editor.addLineClass(line, 'wrap', 'struct-note-md-code-line')
          }
        }
      }

      editor.on('change', refreshLineStyles)
      refreshLineStyles()

      return () => {
        editor.off('change', refreshLineStyles)
      }
    },
  }
}
