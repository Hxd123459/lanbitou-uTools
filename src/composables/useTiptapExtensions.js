import { Markdown } from '@tiptap/markdown'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { common, createLowlight } from 'lowlight'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
import { SlashCommandExtension } from '../extensions/tiptapSlashCommand'

const lowlight = createLowlight(common)

export function createTiptapExtensions(options = {}) {
  const {
    placeholder = '输入 "/" 唤起快捷命令…',
    slashCommand = true,
    dragHandle = false,
    dragHandleOptions = {},
  } = options

  const extensions = [
    StarterKit.configure({
      codeBlock: false,
      heading: {
        levels: [1, 2, 3],
      },
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'plaintext',
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Markdown,
    Placeholder.configure({
      placeholder,
      showOnlyWhenEditable: true,
    }),
  ]

  if (slashCommand) {
    extensions.push(SlashCommandExtension)
  }

  if (dragHandle) {
    extensions.push(
      GlobalDragHandle.configure({
        dragHandleWidth: 40,
        scrollTreshold: 100,
        excludedTags: [],
        dragHandleSelector: '.struct-note-drag-handle-target',
        ...dragHandleOptions,
      }),
    )
  }

  return extensions
}
