export const slashCommandItems = [
  {
    title: '正文',
    description: '普通段落文本',
    icon: 'paragraph',
    keywords: ['正文', 'text', 'paragraph', 'p'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    },
  },
  {
    title: '标题 1',
    description: '大标题',
    icon: 'h1',
    keywords: ['标题1', 'h1', 'heading1'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
    },
  },
  {
    title: '标题 2',
    description: '中标题',
    icon: 'h2',
    keywords: ['标题2', 'h2', 'heading2'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
  },
  {
    title: '标题 3',
    description: '小标题',
    icon: 'h3',
    keywords: ['标题3', 'h3', 'heading3'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
  },
  {
    title: '有序列表',
    description: '带编号的列表',
    icon: 'ol',
    keywords: ['有序', 'ol', 'ordered', 'numbered'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: '无序列表',
    description: '项目符号列表',
    icon: 'ul',
    keywords: ['无序', 'ul', 'bullet', 'list'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: '任务列表',
    description: '可勾选的待办项',
    icon: 'task',
    keywords: ['任务', 'todo', 'task', 'checkbox'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: '引用',
    description: '引用一段文字',
    icon: 'quote',
    keywords: ['引用', 'quote', 'blockquote'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: '代码块',
    description: '语法高亮代码',
    icon: 'code',
    keywords: ['代码', 'code', 'codeblock'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run()
    },
  },
]

export function filterSlashCommandItems(query) {
  const q = query.trim().toLowerCase()
  if (!q) return slashCommandItems
  return slashCommandItems.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
  )
}
