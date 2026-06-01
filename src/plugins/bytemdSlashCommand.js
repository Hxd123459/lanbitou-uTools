const MENU_CLASS = 'struct-note-slash-menu'

function stripBlockPrefix(line) {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^-\s+\[[ xX]\]\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
}

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
    apply({ replaceLines }) {
      replaceLines((line) => stripBlockPrefix(line))
    },
  },
  {
    id: 'h1',
    label: '标题 1',
    keywords: ['标题1', 'h1', 'heading1'],
    icon: ICONS.h1,
    apply({ replaceLines }) {
      replaceLines((line) => `# ${stripBlockPrefix(line)}`.trimEnd())
    },
  },
  {
    id: 'h2',
    label: '标题 2',
    keywords: ['标题2', 'h2', 'heading2'],
    icon: ICONS.h2,
    apply({ replaceLines }) {
      replaceLines((line) => `## ${stripBlockPrefix(line)}`.trimEnd())
    },
  },
  {
    id: 'h3',
    label: '标题 3',
    keywords: ['标题3', 'h3', 'heading3'],
    icon: ICONS.h3,
    apply({ replaceLines }) {
      replaceLines((line) => `### ${stripBlockPrefix(line)}`.trimEnd())
    },
  },
  {
    id: 'ol',
    label: '有序列表',
    keywords: ['有序', 'ol', 'ordered', 'numbered'],
    icon: ICONS.ol,
    apply({ replaceLines }) {
      replaceLines((line) => `1. ${stripBlockPrefix(line)}`.trimEnd())
    },
  },
  {
    id: 'ul',
    label: '无序列表',
    keywords: ['无序', 'ul', 'bullet', 'list'],
    icon: ICONS.ul,
    apply({ replaceLines }) {
      replaceLines((line) => `- ${stripBlockPrefix(line)}`.trimEnd())
    },
  },
  {
    id: 'task',
    label: '任务列表',
    keywords: ['任务', 'todo', 'task', 'checkbox'],
    icon: ICONS.task,
    apply({ replaceLines }) {
      replaceLines((line) => `- [ ] ${stripBlockPrefix(line)}`.trimEnd())
    },
  },
  {
    id: 'quote',
    label: '引用',
    keywords: ['引用', 'quote', 'blockquote'],
    icon: ICONS.quote,
    apply({ replaceLines }) {
      replaceLines((line) => `> ${stripBlockPrefix(line)}`.trimEnd())
    },
  },
  {
    id: 'code',
    label: '代码块',
    keywords: ['代码', 'code', 'codeblock'],
    icon: ICONS.code,
    apply({ editor, appendBlock }) {
      const cursor = editor.getCursor()
      const line = editor.getLine(cursor.line)
      const text = stripBlockPrefix(line).trim()
      if (text) {
        editor.replaceRange(
          `\`\`\`\n${text}\n\`\`\``,
          { line: cursor.line, ch: 0 },
          { line: cursor.line, ch: line.length },
        )
        return
      }
      const pos = appendBlock('```\n\n```')
      editor.setCursor({ line: pos.line + 1, ch: 0 })
    },
  },
]

function getSlashContext(editor) {
  const cursor = editor.getCursor()
  const lineText = editor.getLine(cursor.line)
  const before = lineText.slice(0, cursor.ch)
  const match = before.match(/(?:^|\s)\/([^\s/]*)$/)
  if (!match) return null
  const slashIndex = before.lastIndexOf('/')
  return {
    from: { line: cursor.line, ch: slashIndex },
    to: cursor,
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

export function slashCommandPlugin() {
  return {
    editorEffect(ctx) {
      const { editor, root } = ctx
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

      const positionMenu = (menu, slash) => {
        const coords = editor.charCoords(slash.from, 'window')
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
            top = Math.max(
              viewportPadding,
              coords.top - rect.height - 6,
            )
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

      const renderMenu = () => {
        const slash = getSlashContext(editor)
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

        positionMenu(menu, slash)
      }

      const removeSlashToken = () => {
        const slash = getSlashContext(editor)
        if (!slash) return null
        editor.replaceRange('', slash.from, slash.to)
        return slash
      }

      const applyCommand = (command) => {
        removeSlashToken()
        command.apply(ctx)
        hideMenu()
        editor.focus()
      }

      const onCursorActivity = () => {
        renderMenu()
      }

      const onKeyDown = (_cm, event) => {
        if (!menuEl || menuEl.hidden) return

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          selectedIndex = (selectedIndex + 1) % visibleCommands.length
          renderMenu()
          return
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          selectedIndex = (selectedIndex - 1 + visibleCommands.length) % visibleCommands.length
          renderMenu()
          return
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          const command = visibleCommands[selectedIndex]
          if (command) applyCommand(command)
          return
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          removeSlashToken()
          hideMenu()
        }
      }

      const onBlur = () => {
        window.setTimeout(() => {
          if (suppressBlurHide) {
            suppressBlurHide = false
            editor.focus()
            return
          }
          hideMenu()
        }, 120)
      }

      editor.on('cursorActivity', onCursorActivity)
      editor.on('keydown', onKeyDown)
      editor.on('blur', onBlur)

      return () => {
        editor.off('cursorActivity', onCursorActivity)
        editor.off('keydown', onKeyDown)
        editor.off('blur', onBlur)
        menuEl?.remove()
        menuEl = null
      }
    },
  }
}
