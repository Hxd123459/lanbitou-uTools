import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import { fetchNoteList, searchNotes } from '../api/note'
import { getTextareaCaretCoords } from '../utils/textareaCaret'

const MENU_CLASS = 'struct-note-slash-menu'
const NOTE_LIST_SIZE = 10
const SEARCH_DEBOUNCE_MS = 200

export function getAtTriggerState(text, caretPos) {
  const before = String(text ?? '').slice(0, caretPos)
  const match = before.match(/(?:^|\s)@([^\s@]*)$/)
  if (!match) return null

  const atIndex = before.lastIndexOf('@')
  return {
    from: atIndex,
    to: caretPos,
    query: match[1] || '',
  }
}

export function noteTagLabel(note) {
  return String(note?.title || '').trim()
}

export function noteTimeText(dateValue) {
  if (!dateValue) return '----'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '----'
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

export function notePreviewText(note, maxLen = 72) {
  const text = String(note?.text || note?.summary || note?.markdownContent || '').trim()
  if (!text) return '（空内容）'
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

export function useNoteAtPicker({
  getText,
  setText,
  getTextarea,
  onNoteSelected,
  getExcludedIds = () => [],
}) {
  const notes = ref([])
  const notesLoading = ref(false)
  const menuOpen = ref(false)
  const menuStyle = ref({ left: '0px', top: '0px', visibility: 'hidden' })
  const selectedIndex = ref(0)
  const atState = shallowRef(null)
  const suppressBlurHide = ref(false)
  let lastQuery = ''
  let searchToken = 0
  let searchTimer = null

  const filteredItems = computed(() => {
    const excluded = new Set(getExcludedIds())
    return notes.value
      .filter((note) => note?.id && !excluded.has(note.id))
      .slice(0, NOTE_LIST_SIZE)
      .map((note) => ({
        type: 'note',
        noteId: note.id,
        note,
        tag: noteTagLabel(note),
        time: noteTimeText(note.createdAt),
        preview: notePreviewText(note),
      }))
  })

  const loadNotes = async (query = '') => {
    const token = ++searchToken
    notesLoading.value = true
    try {
      const q = String(query ?? '').trim()
      const result = q
        ? await searchNotes({ keyword: q, page: 1, pageSize: NOTE_LIST_SIZE })
        : await fetchNoteList({ pageNo: 1, pageSize: NOTE_LIST_SIZE })
      if (token !== searchToken) return
      notes.value = result?.list || []
    } catch {
      if (token === searchToken) notes.value = []
    } finally {
      if (token === searchToken) notesLoading.value = false
    }
  }

  const scheduleLoadNotes = (query = '') => {
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }

    const q = String(query ?? '').trim()
    if (!q) {
      loadNotes('')
      return
    }

    searchTimer = window.setTimeout(() => {
      searchTimer = null
      loadNotes(q)
    }, SEARCH_DEBOUNCE_MS)
  }

  const closeMenu = () => {
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    menuOpen.value = false
    atState.value = null
    selectedIndex.value = 0
    lastQuery = ''
    menuStyle.value = { left: '0px', top: '0px', visibility: 'hidden' }
  }

  const positionMenu = async () => {
    const textarea = getTextarea()
    const state = atState.value
    if (!textarea || !state) return

    await nextTick()
    const caret = getTextareaCaretCoords(textarea, state.from)
    const viewportPadding = 8
    let left = caret.left
    let top = caret.top + caret.height + 6

    menuStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
      visibility: 'hidden',
    }

    requestAnimationFrame(() => {
      const menuEl = document.querySelector(`.${MENU_CLASS}[data-note-at-menu]`)
      if (!menuEl) return

      const rect = menuEl.getBoundingClientRect()
      if (rect.bottom > window.innerHeight - viewportPadding) {
        top = Math.max(viewportPadding, caret.top - rect.height - 6)
      }
      if (left + rect.width > window.innerWidth - viewportPadding) {
        left = Math.max(
          viewportPadding,
          window.innerWidth - rect.width - viewportPadding,
        )
      }

      menuStyle.value = {
        left: `${left}px`,
        top: `${top}px`,
        visibility: 'visible',
      }
    })
  }

  const scrollActiveItemIntoView = () => {
    nextTick(() => {
      const menuEl = document.querySelector(`.${MENU_CLASS}[data-note-at-menu]`)
      if (!menuEl) return
      const activeEl = menuEl.querySelector('.struct-note-slash-menu__item--active')
      activeEl?.scrollIntoView({ block: 'nearest' })
    })
  }

  const syncMenu = async () => {
    const textarea = getTextarea()
    if (!textarea) {
      closeMenu()
      return
    }

    const state = getAtTriggerState(getText(), textarea.selectionStart)
    if (!state) {
      closeMenu()
      return
    }

    const opening = !menuOpen.value
    atState.value = state
    menuOpen.value = true
    if (opening || state.query !== lastQuery) {
      if (state.query.trim()) {
        scheduleLoadNotes(state.query)
      } else {
        await loadNotes('')
      }
    }
    if (state.query !== lastQuery) {
      selectedIndex.value = 0
      lastQuery = state.query
    }
    if (selectedIndex.value >= filteredItems.value.length) {
      selectedIndex.value = Math.max(0, filteredItems.value.length - 1)
    }
    await positionMenu()
    scrollActiveItemIntoView()
  }

  const removeAtToken = () => {
    const state = atState.value
    if (!state) return
    const text = getText()
    const next = `${text.slice(0, state.from)}${text.slice(state.to)}`
    setText(next)
    closeMenu()
    nextTick(() => {
      const textarea = getTextarea()
      if (!textarea) return
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = state.from
    })
  }

  const applyItem = (item) => {
    if (!item?.note) return
    removeAtToken()
    onNoteSelected?.(item.note)
  }

  const selectCurrent = () => {
    const item = filteredItems.value[selectedIndex.value]
    if (item) applyItem(item)
  }

  const onMenuMouseDown = () => {
    suppressBlurHide.value = true
  }

  const onTextareaBlur = () => {
    window.setTimeout(() => {
      if (suppressBlurHide.value) {
        suppressBlurHide.value = false
        getTextarea()?.focus()
        return
      }
      closeMenu()
    }, 120)
  }

  const handleKeyDown = (event) => {
    if (!menuOpen.value || !filteredItems.value.length) return false

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedIndex.value = Math.min(
        selectedIndex.value + 1,
        filteredItems.value.length - 1,
      )
      scrollActiveItemIntoView()
      return true
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      scrollActiveItemIntoView()
      return true
    }

    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault()
      selectCurrent()
      return true
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      removeAtToken()
      return true
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      selectCurrent()
      return true
    }

    return false
  }

  onBeforeUnmount(() => {
    closeMenu()
  })

  return {
    notesLoading,
    menuOpen,
    menuStyle,
    selectedIndex,
    filteredItems,
    syncMenu,
    closeMenu,
    applyItem,
    handleKeyDown,
    onMenuMouseDown,
    onTextareaBlur,
    removeAtToken,
  }
}
