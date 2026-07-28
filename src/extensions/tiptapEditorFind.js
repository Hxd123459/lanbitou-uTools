import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const editorFindPluginKey = new PluginKey('editorFind')

function findTextMatches(doc, query) {
  const term = String(query ?? '').trim()
  if (!term) return []

  const lowerTerm = term.toLowerCase()
  const chunks = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (let i = 0; i < node.text.length; i += 1) {
      chunks.push({ char: node.text[i], pos: pos + i })
    }
  })

  if (!chunks.length) return []

  const lowerFull = chunks.map((chunk) => chunk.char).join('').toLowerCase()
  const matches = []
  let start = 0
  let index = lowerFull.indexOf(lowerTerm, start)

  while (index !== -1) {
    const from = chunks[index].pos
    const endIndex = index + term.length - 1
    if (endIndex < chunks.length) {
      const to = chunks[endIndex].pos + 1
      matches.push({ from, to })
    }
    start = index + (term.length || 1)
    index = lowerFull.indexOf(lowerTerm, start)
  }

  return matches
}

function buildDecorations(doc, matches, activeIndex) {
  if (!matches.length) return DecorationSet.empty

  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === activeIndex
        ? 'note-highlight is-active-find'
        : 'note-highlight',
    }),
  )

  return DecorationSet.create(doc, decorations)
}

function scrollToMatch(editor, match) {
  if (!match || !editor?.view) return

  const { view } = editor
  const selection = TextSelection.create(view.state.doc, match.from, match.to)
  view.dispatch(view.state.tr.setSelection(selection))

  requestAnimationFrame(() => {
    const column = view.dom.closest('.struct-note-editor-column')
    if (!column) return

    let coords
    let endCoords
    try {
      coords = view.coordsAtPos(match.from)
      endCoords = view.coordsAtPos(Math.max(match.from, match.to - 1))
    } catch {
      return
    }

    const columnRect = column.getBoundingClientRect()
    const margin = 48
    const matchTop = coords.top
    const matchBottom = endCoords.bottom

    if (matchBottom > columnRect.bottom - margin) {
      column.scrollTop += matchBottom - columnRect.bottom + margin
    } else if (matchTop < columnRect.top + margin) {
      column.scrollTop -= columnRect.top + margin - matchTop
    }
  })
}

function resolveFindState(state, query, activeIndex = -1) {
  const matches = findTextMatches(state.doc, query)
  let nextIndex = activeIndex
  if (!matches.length) {
    nextIndex = -1
  } else if (nextIndex < 0 || nextIndex >= matches.length) {
    nextIndex = 0
  }
  return { query, matches, activeIndex: nextIndex }
}

function scheduleScrollToMatch(editor, match) {
  if (!match) return
  requestAnimationFrame(() => scrollToMatch(editor, match))
}

export function createEditorFindExtension() {
  return Extension.create({
    name: 'editorFind',

    addCommands() {
      return {
        setFindQuery:
          (query) =>
          ({ editor, tr }) => {
            const next = resolveFindState(editor.state, query, 0)
            tr.setMeta(editorFindPluginKey, next)
            if (next.activeIndex >= 0) {
              scheduleScrollToMatch(editor, next.matches[next.activeIndex])
            }
            return true
          },

        findNext:
          () =>
          ({ editor, tr }) => {
            const current = editorFindPluginKey.getState(editor.state)
            if (!current?.matches?.length) return false
            const activeIndex = (current.activeIndex + 1) % current.matches.length
            const next = { ...current, activeIndex }
            tr.setMeta(editorFindPluginKey, next)
            scheduleScrollToMatch(editor, next.matches[activeIndex])
            return true
          },

        findPrevious:
          () =>
          ({ editor, tr }) => {
            const current = editorFindPluginKey.getState(editor.state)
            if (!current?.matches?.length) return false
            const activeIndex =
              (current.activeIndex - 1 + current.matches.length) % current.matches.length
            const next = { ...current, activeIndex }
            tr.setMeta(editorFindPluginKey, next)
            scheduleScrollToMatch(editor, next.matches[activeIndex])
            return true
          },

        clearFind:
          () =>
          ({ tr }) => {
            tr.setMeta(editorFindPluginKey, {
              query: '',
              matches: [],
              activeIndex: -1,
            })
            return true
          },
      }
    },

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: editorFindPluginKey,
          state: {
            init() {
              return { query: '', matches: [], activeIndex: -1 }
            },
            apply(tr, value, _oldState, newState) {
              const meta = tr.getMeta(editorFindPluginKey)
              if (meta) return meta
              if (tr.docChanged && value.query) {
                return resolveFindState(newState, value.query, value.activeIndex)
              }
              return value
            },
          },
          props: {
            decorations(state) {
              const pluginState = editorFindPluginKey.getState(state)
              if (!pluginState?.matches?.length) return DecorationSet.empty
              return buildDecorations(
                state.doc,
                pluginState.matches,
                pluginState.activeIndex,
              )
            },
          },
        }),
      ]
    },
  })
}

export function getEditorFindState(editor) {
  if (!editor || editor.isDestroyed) {
    return { query: '', matches: [], activeIndex: -1, matchCount: 0 }
  }
  const state = editorFindPluginKey.getState(editor.state) || {
    query: '',
    matches: [],
    activeIndex: -1,
  }
  return {
    ...state,
    matchCount: state.matches?.length ?? 0,
  }
}
