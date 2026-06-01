import { VueRenderer } from '@tiptap/vue-3'
import { PluginKey } from '@tiptap/pm/state'
import TiptapSlashMenuList from '../../components/tiptap/TiptapSlashMenuList.vue'
import { filterSlashCommandItems } from './slashCommandItems'

export const slashSuggestionPluginKey = new PluginKey('slashSuggestion')

function positionPopup(element, clientRect) {
  const rect = clientRect?.()
  if (!rect || !element) return

  element.style.position = 'fixed'
  element.style.left = `${rect.left}px`
  element.style.top = `${rect.bottom + 6}px`
  element.style.zIndex = '10000'

  requestAnimationFrame(() => {
    const menuRect = element.getBoundingClientRect()
    const padding = 8

    if (menuRect.bottom > window.innerHeight - padding) {
      element.style.top = `${Math.max(padding, rect.top - menuRect.height - 6)}px`
    }

    if (menuRect.right > window.innerWidth - padding) {
      element.style.left = `${Math.max(
        padding,
        window.innerWidth - menuRect.width - padding,
      )}px`
    }
  })
}

export function createSlashSuggestionRender() {
  let component
  let popup

  return () => ({
    onStart: (props) => {
      component = new VueRenderer(TiptapSlashMenuList, {
        props,
        editor: props.editor,
      })

      popup = document.createElement('div')
      popup.className = 'tiptap-slash-menu-host'
      popup.appendChild(component.element)
      document.body.appendChild(popup)
      positionPopup(popup, props.clientRect)
    },

    onUpdate: (props) => {
      component?.updateProps(props)
      positionPopup(popup, props.clientRect)
    },

    onKeyDown: (props) => {
      if (props.event.key === 'Escape') {
        popup?.remove()
        component?.destroy()
        return true
      }
      return component?.ref?.onKeyDown?.(props) ?? false
    },

    onExit: () => {
      popup?.remove()
      component?.destroy()
      popup = null
      component = null
    },
  })
}

export const slashSuggestionConfig = {
  char: '/',
  pluginKey: slashSuggestionPluginKey,
  items: ({ query }) => filterSlashCommandItems(query),
  render: createSlashSuggestionRender(),
  command: ({ editor, range, props }) => {
    props.command({ editor, range })
  },
}
