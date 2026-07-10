import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const pluginKey = new PluginKey('orderedListStyle')

// 有序列表嵌套层级：1. → a. → i. → 1. …
const NESTED_TYPES = [null, 'a', 'i']

function countOrderedListDepth(doc, pos) {
  const $pos = doc.resolve(pos)
  let depth = 0

  for (let d = $pos.depth; d > 0; d -= 1) {
    if ($pos.node(d).type.name === 'orderedList') {
      depth += 1
    }
  }

  return depth
}

function buildOrderedListTypeTransaction(state) {
  const orderedListType = state.schema.nodes.orderedList
  if (!orderedListType) return null

  let tr = state.tr
  let changed = false

  state.doc.descendants((node, pos) => {
    if (node.type !== orderedListType) return

    const depth = countOrderedListDepth(state.doc, pos + 1)
    const nextType = NESTED_TYPES[(depth - 1) % NESTED_TYPES.length] ?? null
    const currentType = node.attrs.type ?? null

    if (currentType === nextType) return

    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      type: nextType,
    })
    changed = true
  })

  return changed ? tr : null
}

export const OrderedListStyleExtension = Extension.create({
  name: 'orderedListStyle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null
          }

          return buildOrderedListTypeTransaction(newState)
        },
      }),
    ]
  },
})
