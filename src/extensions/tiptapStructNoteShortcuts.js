import { Extension } from '@tiptap/core'
import {
  STRUCT_NOTE_EDITOR_COMMANDS,
  runStructNoteEditorCommand,
} from '../constants/structNoteEditorCommands'

export const StructNoteShortcutsExtension = Extension.create({
  name: 'structNoteShortcuts',
  priority: 1000,

  addKeyboardShortcuts() {
    const bindings = {}

    STRUCT_NOTE_EDITOR_COMMANDS.forEach((command) => {
      if (!command.shortcut) return

      bindings[command.shortcut] = () =>
        runStructNoteEditorCommand(this.editor, command)
    })

    return bindings
  },
})
