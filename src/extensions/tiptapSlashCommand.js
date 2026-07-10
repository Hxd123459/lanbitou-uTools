import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { STRUCT_NOTE_EDITOR_COMMANDS } from '../constants/structNoteEditorCommands'
import { formatTiptapShortcut } from '../utils/formatTiptapShortcut'

const MENU_CLASS = 'struct-note-slash-menu'
const pluginKey = new PluginKey('slashCommand')

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
  if (!q) return STRUCT_NOTE_EDITOR_COMMANDS
  return STRUCT_NOTE_EDITOR_COMMANDS.filter(
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
  let visibleCommands = STRUCT_NOTE_EDITOR_COMMANDS
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
            ${
              cmd.shortcut
                ? `<span class="${MENU_CLASS}__shortcut">${formatTiptapShortcut(cmd.shortcut)}</span>`
                : ''
            }
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
