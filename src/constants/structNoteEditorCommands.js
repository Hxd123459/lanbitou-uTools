import { slashMenuIcons } from './slashMenuIcons'

export const STRUCT_NOTE_EDITOR_COMMANDS = [
  {
    id: 'paragraph',
    label: '正文',
    shortcut: 'Mod-0',
    keywords: ['正文', 'text', 'paragraph', 'p'],
    icon: slashMenuIcons.paragraph,
    run: (chain) => chain.setParagraph(),
  },
  {
    id: 'h1',
    label: '标题 1',
    shortcut: 'Mod-1',
    keywords: ['标题1', 'h1', 'heading1'],
    icon: slashMenuIcons.h1,
    run: (chain) => chain.setHeading({ level: 1 }),
  },
  {
    id: 'h2',
    label: '标题 2',
    shortcut: 'Mod-2',
    keywords: ['标题2', 'h2', 'heading2'],
    icon: slashMenuIcons.h2,
    run: (chain) => chain.setHeading({ level: 2 }),
  },
  {
    id: 'h3',
    label: '标题 3',
    shortcut: 'Mod-3',
    keywords: ['标题3', 'h3', 'heading3'],
    icon: slashMenuIcons.h3,
    run: (chain) => chain.setHeading({ level: 3 }),
  },
  {
    id: 'ol',
    label: '有序列表',
    shortcut: 'Mod-4',
    keywords: ['有序', 'ol', 'ordered', 'numbered'],
    icon: slashMenuIcons.ol,
    run: (chain) => chain.toggleOrderedList(),
  },
  {
    id: 'ul',
    label: '无序列表',
    shortcut: 'Mod-5',
    keywords: ['无序', 'ul', 'bullet', 'list'],
    icon: slashMenuIcons.ul,
    run: (chain) => chain.toggleBulletList(),
  },
  {
    id: 'task',
    label: '任务列表',
    shortcut: 'Mod-6',
    keywords: ['任务', 'todo', 'task', 'checkbox'],
    icon: slashMenuIcons.task,
    run: (chain) => chain.toggleTaskList(),
  },
  {
    id: 'quote',
    label: '引用',
    shortcut: 'Mod-7',
    keywords: ['引用', 'quote', 'blockquote'],
    icon: slashMenuIcons.quote,
    run: (chain) => chain.toggleBlockquote(),
  },
  {
    id: 'code',
    label: '代码块',
    shortcut: 'Mod-8',
    keywords: ['代码', 'code', 'codeblock'],
    icon: slashMenuIcons.code,
    run: (chain) => chain.setCodeBlock(),
  },
]

export function runStructNoteEditorCommand(editor, command) {
  const chain = editor.chain().focus()
  command.run(chain)
  return chain.run()
}
