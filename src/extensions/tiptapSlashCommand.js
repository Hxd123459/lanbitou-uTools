import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const MENU_CLASS = 'struct-note-slash-menu'
const pluginKey = new PluginKey('slashCommand')

const ICONS = {
  paragraph:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h14"/></svg>',
  h1: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4v16M18 4v16M6 12h12M10 8h8M10 16h8"/></svg>',
  h2: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4v16M18 4v16M6 12h12M11 8h6M11 16h6"/></svg>',
  h3: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4v16M18 4v16M6 12h12M12 8h4M12 16h4"/></svg>',
  ol: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  ul: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1.5" fill="currentColor" stroke="none"/><path d="M9 6h10M9 12h10M9 18h10"/></svg>',
  task: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="14" height="14" rx="2"/><path d="M8 12l2.5 2.5L16 9"/></svg>',
  quote:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M7 7h4v4H7V7zm6 0h4v4h-4V7zM5 11c0 2.2 1.8 4 4 4v2C5.6 17 3 14.4 3 11h2zm10 0c0 2.2 1.8 4 4 4v2c-3.4 0-6-2.6-6-6h2z"/></svg>',
  code: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 8L4 12l4 4M16 8l4 4-4 4"/></svg>',
}

const SLASH_COMMANDS = [
  {
    id: 'paragraph',
    label: '正文',
    keywords: ['正文', 'text', 'paragraph', 'p'],
    icon: ICONS.paragraph,
    run: (chain) => chain.setParagraph(),
  },
  {
    id: 'h1',
    label: '标题 1',
    keywords: ['标题1', 'h1', 'heading1'],
    icon: ICONS.h1,
    run: (chain) => chain.setHeading({ level: 1 }),
  },
  {
    id: 'h2',
    label: '标题 2',
    keywords: ['标题2', 'h2', 'heading2'],
    icon: ICONS.h2,
    run: (chain) => chain.setHeading({ level: 2 }),
  },
  {
    id: 'h3',
    label: '标题 3',
    keywords: ['标题3', 'h3', 'heading3'],
    icon: ICONS.h3,
    run: (chain) => chain.setHeading({ level: 3 }),
  },
  {
    id: 'ol',
    label: '有序列表',
    keywords: ['有序', 'ol', 'ordered', 'numbered'],
    icon: ICONS.ol,
    run: (chain) => chain.toggleOrderedList(),
  },
  {
    id: 'ul',
    label: '无序列表',
    keywords: ['无序', 'ul', 'bullet', 'list'],
    icon: ICONS.ul,
    run: (chain) => chain.toggleBulletList(),
  },
  {
    id: 'task',
    label: '任务列表',
    keywords: ['任务', 'todo', 'task', 'checkbox'],
    icon: ICONS.task,
    run: (chain) => chain.toggleTaskList(),
  },
  {
    id: 'quote',
    label: '引用',
    keywords: ['引用', 'quote', 'blockquote'],
    icon: ICONS.quote,
    run: (chain) => chain.toggleBlockquote(),
  },
  {
    id: 'code',
    label: '代码块',
    keywords: ['代码', 'code', 'codeblock'],
    icon: ICONS.code,
    run: (chain) => chain.setCodeBlock(),
  },
]

function getSlashState(view) {
  const { $from } = view.state.selection
  if (!$from.parent.isTextblock) return null

  const textBefore = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    '\ufffc',
  )
  const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/)
  if (!match) return null

  const slashIndex = textBefore.lastIndexOf('/')
  return {
    from: $from.start() + slashIndex,
    to: $from.pos,
    query: match[1] || '',
  }
}

function filterCommands(query) {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
  )
}

function positionMenu(menu, view, slash) {
  const coords = view.coordsAtPos(slash.from)
  menu.style.visibility = 'hidden'
  menu.style.left = `${coords.left}px`
  menu.style.top = `${coords.bottom + 6}px`
  menu.hidden = false

  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect()
    const viewportPadding = 8
    let top = coords.bottom + 6
    let left = coords.left

    if (rect.bottom > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, coords.top - rect.height - 6)
    }
    if (left + rect.width > window.innerWidth - viewportPadding) {
      left = Math.max(
        viewportPadding,
        window.innerWidth - rect.width - viewportPadding,
      )
    }
    if (left < viewportPadding) {
      left = viewportPadding
    }

    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
    menu.style.visibility = 'visible'
  })
}

function createSlashMenuController(editor) {
  let menuEl = null
  let selectedIndex = 0
  let visibleCommands = SLASH_COMMANDS
  let suppressBlurHide = false

  const ensureMenu = () => {
    if (menuEl) return menuEl
    menuEl = document.createElement('div')
    menuEl.className = MENU_CLASS
    menuEl.setAttribute('role', 'listbox')
    menuEl.hidden = true
    document.body.appendChild(menuEl)

    menuEl.addEventListener('mousedown', (event) => {
      event.preventDefault()
      suppressBlurHide = true
    })

    menuEl.addEventListener('click', (event) => {
      const item = event.target.closest('[data-slash-index]')
      if (!item) return
      const index = Number(item.dataset.slashIndex)
      const command = visibleCommands[index]
      if (command) applyCommand(command)
    })

    return menuEl
  }

  const hideMenu = () => {
    if (!menuEl) return
    menuEl.hidden = true
    menuEl.innerHTML = ''
    selectedIndex = 0
  }

  const applyCommand = (command) => {
    if (!editor.view) return
    const slash = getSlashState(editor.view)
    if (!slash) return

    const chain = editor
      .chain()
      .focus()
      .deleteRange({ from: slash.from, to: slash.to })

    command.run(chain)
    chain.run()
    hideMenu()
  }

  const renderMenu = (view) => {
    const slash = getSlashState(view)
    if (!slash) {
      hideMenu()
      return
    }

    visibleCommands = filterCommands(slash.query)
    if (!visibleCommands.length) {
      hideMenu()
      return
    }

    if (selectedIndex >= visibleCommands.length) {
      selectedIndex = visibleCommands.length - 1
    }

    const menu = ensureMenu()
    menu.innerHTML = visibleCommands
      .map(
        (cmd, index) => `
          <button
            type="button"
            class="${MENU_CLASS}__item${index === selectedIndex ? ` ${MENU_CLASS}__item--active` : ''}"
            data-slash-index="${index}"
            role="option"
            aria-selected="${index === selectedIndex}"
          >
            <span class="${MENU_CLASS}__icon" aria-hidden="true">${cmd.icon}</span>
            <span class="${MENU_CLASS}__label">${cmd.label}</span>
          </button>
        `,
      )
      .join('')

    positionMenu(menu, view, slash)
  }

  const handleKeyDown = (view, event) => {
    if (!menuEl || menuEl.hidden) return false

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedIndex = (selectedIndex + 1) % visibleCommands.length
      renderMenu(view)
      return true
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedIndex =
        (selectedIndex - 1 + visibleCommands.length) % visibleCommands.length
      renderMenu(view)
      return true
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const command = visibleCommands[selectedIndex]
      if (command) applyCommand(command)
      return true
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      const slash = getSlashState(view)
      if (slash) {
        editor
          .chain()
          .focus()
          .deleteRange({ from: slash.from, to: slash.to })
          .run()
      }
      hideMenu()
      return true
    }

    return false
  }

  const handleBlur = () => {
    window.setTimeout(() => {
      if (suppressBlurHide) {
        suppressBlurHide = false
        editor.commands.focus()
        return
      }
      hideMenu()
    }, 120)
  }

  const destroy = () => {
    hideMenu()
    menuEl?.remove()
    menuEl = null
  }

  return {
    renderMenu,
    handleKeyDown,
    handleBlur,
    destroy,
  }
}

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    const editor = this.editor
    const menu = createSlashMenuController(editor)

    return [
      new Plugin({
        key: pluginKey,
        view(view) {
          return {
            update(nextView, prevState) {
              if (
                nextView.state.doc.eq(prevState.doc) &&
                nextView.state.selection.eq(prevState.selection)
              ) {
                return
              }
              menu.renderMenu(nextView)
            },
            destroy() {
              menu.destroy()
            },
          }
        },
        props: {
          handleKeyDown(view, event) {
            return menu.handleKeyDown(view, event)
          },
          handleDOMEvents: {
            blur() {
              menu.handleBlur()
              return false
            },
          },
        },
      }),
    ]
  },
})
