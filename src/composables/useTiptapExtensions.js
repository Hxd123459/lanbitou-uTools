import { Markdown } from '@tiptap/markdown'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { common, createLowlight } from 'lowlight'
import { MarkdownPasteExtension } from '../extensions/tiptapMarkdownPaste'
import { createFragmentIntroBlockExtension } from '../extensions/tiptapFragmentIntroBlock'
import { LazyAttachmentImage } from '../extensions/tiptapLazyAttachmentImage'
import { OrderedListStyleExtension } from '../extensions/tiptapOrderedListStyle'
import { SlashCommandExtension } from '../extensions/tiptapSlashCommand'
import { StructNoteShortcutsExtension } from '../extensions/tiptapStructNoteShortcuts'
import {
  CodeSafeBold,
  CodeSafeItalic,
  CodeSafeLink,
  CodeSafeStrike,
} from '../utils/tiptapCodeSafeMarkdown'

const lowlight = createLowlight(common)

export function createTiptapExtensions(options = {}) {
  const {
    placeholder = '输入 "/" 唤起快捷命令…',
    slashCommand = true,
    markdownPaste = true,
    enableImage = false,
    enableFragmentIntro = false,
    fragmentIntroOptions = {},
  } = options

  const extensions = [
    StarterKit.configure({
      bold: false,
      codeBlock: false,
      heading: {
        levels: [1, 2, 3],
      },
      italic: false,
      link: false,
      strike: false,
    }),
    CodeSafeBold,
    CodeSafeItalic,
    CodeSafeStrike,
    CodeSafeLink,
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
    OrderedListStyleExtension,
  ]

  if (enableImage) {
    extensions.push(
      LazyAttachmentImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'tiptap-image',
        },
      }),
    )
  }

  if (slashCommand) {
    extensions.push(StructNoteShortcutsExtension)
    extensions.push(SlashCommandExtension)
  }

  if (markdownPaste) {
    extensions.push(MarkdownPasteExtension)
  }

  if (enableFragmentIntro) {
    extensions.push(createFragmentIntroBlockExtension(fragmentIntroOptions))
  }

  return extensions
}
