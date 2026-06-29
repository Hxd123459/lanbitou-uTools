import { mergeAttributes, Node } from '@tiptap/core'
import { getIntroduceMethodLabel } from '../ai/sedimentDraftService'

function formatIntroducedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

function buildBadgeLabel(fragmentIds, method, introducedAt) {
  const methodLabel = getIntroduceMethodLabel(method) || 'AI 整理'
  const ids = String(fragmentIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const parts = [methodLabel]
  if (ids.length > 1) {
    parts.push(`${ids.length} 条碎片`)
  }
  const timeLabel = formatIntroducedAt(introducedAt)
  if (timeLabel) {
    parts.push(timeLabel)
  }
  return parts.join(' · ')
}

function buildMarkerStart(attrs) {
  const ids = String(attrs?.fragmentIds ?? '').trim()
  const method = String(attrs?.method ?? '').trim()
  const introducedAt = String(attrs?.introducedAt ?? '').trim()
  if (!ids || !method) return ''
  const atPart = introducedAt ? ` at=${introducedAt}` : ''
  return `<!-- aw-frag-start ids=${ids} method=${method}${atPart} -->`
}

export const FragmentIntroBlock = Node.create({
  name: 'fragmentIntroBlock',

  group: 'block',

  content: 'block+',

  defining: true,

  isolating: true,

  addAttributes() {
    return {
      fragmentIds: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-fragment-ids') || '',
        renderHTML: (attributes) => ({
          'data-fragment-ids': attributes.fragmentIds || '',
        }),
      },
      method: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-method') || '',
        renderHTML: (attributes) => ({
          'data-method': attributes.method || '',
        }),
      },
      introducedAt: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-introduced-at') || '',
        renderHTML: (attributes) => ({
          'data-introduced-at': attributes.introducedAt || '',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="aw-fragment-intro"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'aw-fragment-intro',
        class: 'aw-fragment-intro',
      }),
      0,
    ]
  },

  renderMarkdown: (node, helpers) => {
    const ids = String(node.attrs?.fragmentIds ?? '').trim()
    const method = String(node.attrs?.method ?? '').trim()
    const inner = helpers.renderChildren(node).trim()
    if (!ids || !method) return inner
    const start = buildMarkerStart(node.attrs)
    const end = `<!-- aw-frag-end ids=${ids} -->`
    if (!inner) return `${start}\n${end}`
    return `${start}\n${inner}\n${end}`
  },

  addCommands() {
    return {
      assimilateFragmentIntroBlock:
        (pos) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)
          if (!node || node.type.name !== this.name) return false
          if (dispatch) {
            const tr = state.tr.replaceWith(pos, pos + node.nodeSize, node.content)
            dispatch(tr)
          }
          return true
        },
      removeFragmentIntroBlock:
        (pos) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)
          if (!node || node.type.name !== this.name) return false
          if (dispatch) {
            const tr = state.tr.delete(pos, pos + node.nodeSize)
            dispatch(tr)
          }
          return true
        },
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div')
      dom.className = 'aw-fragment-intro-block'

      const badge = document.createElement('div')
      badge.className = 'aw-fragment-intro-badge'
      badge.contentEditable = 'false'

      const label = document.createElement('span')
      label.className = 'aw-fragment-intro-badge-label'
      label.textContent = buildBadgeLabel(
        node.attrs.fragmentIds,
        node.attrs.method,
        node.attrs.introducedAt,
      )

      const actions = document.createElement('div')
      actions.className = 'aw-fragment-intro-actions'

      const cancelBtn = document.createElement('button')
      cancelBtn.type = 'button'
      cancelBtn.className = 'aw-fragment-intro-cancel'
      cancelBtn.textContent = '取消'
      cancelBtn.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
      })
      cancelBtn.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const pos = typeof getPos === 'function' ? getPos() : null
        if (typeof pos !== 'number') return
        editor.commands.removeFragmentIntroBlock(pos)
      })

      const assimilateBtn = document.createElement('button')
      assimilateBtn.type = 'button'
      assimilateBtn.className = 'aw-fragment-intro-assimilate'
      assimilateBtn.textContent = '融入正文'
      assimilateBtn.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
      })
      assimilateBtn.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const pos = typeof getPos === 'function' ? getPos() : null
        if (typeof pos !== 'number') return
        editor.commands.assimilateFragmentIntroBlock(pos)
      })

      actions.append(cancelBtn, assimilateBtn)
      badge.append(label, actions)

      const contentDOM = document.createElement('div')
      contentDOM.className = 'aw-fragment-intro-content'

      dom.append(badge, contentDOM)

      return {
        dom,
        contentDOM,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false
          label.textContent = buildBadgeLabel(
            updatedNode.attrs.fragmentIds,
            updatedNode.attrs.method,
            updatedNode.attrs.introducedAt,
          )
          return true
        },
      }
    }
  },
})

export function createFragmentIntroBlockExtension() {
  return FragmentIntroBlock
}
