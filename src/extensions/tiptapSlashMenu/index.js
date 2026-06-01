import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { slashSuggestionConfig } from './slashSuggestion'

export const SlashMenuExtension = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: slashSuggestionConfig,
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
