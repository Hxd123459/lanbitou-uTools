import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import { createTag, fetchAllTags } from '../api/note'
import { getTextareaCaretCoords } from '../utils/textareaCaret'

const MENU_CLASS = 'struct-note-slash-menu'
const MAX_TAG_LEN = 5

export function getHashTriggerState(text, caretPos) {
  const before = String(text ?? '').slice(0, caretPos)
  const match = before.match(/(?:^|\s)#([^\s#]*)$/)
  if (!match) return null

  const hashIndex = before.lastIndexOf('#')
  return {
    from: hashIndex,
    to: caretPos,
    query: match[1] || '',
  }
}

export function useTagHashPicker({
  getText,
  setText,
  getTextarea,
  onTagSelected,
}) {
  const tags = ref([])
  const tagsLoading = ref(false)
  const menuOpen = ref(false)
  const menuStyle = ref({ left: '0px', top: '0px', visibility: 'hidden' })
  const selectedIndex = ref(0)
  const hashState = shallowRef(null)
  const suppressBlurHide = ref(false)
  let lastQuery = ''

  const filteredItems = computed(() => {
    const query = hashState.value?.query?.trim() || ''
    const q = query.toLowerCase()
    const matched = tags.value.filter((tag) => {
      if (!q) return true
      return tag.tagName.toLowerCase().includes(q)
    })

    const exact = query && tags.value.some((tag) => tag.tagName === query)
    const items = matched.map((tag) => ({
      type: 'tag',
      tagId: tag.tagId,
      tagName: tag.tagName,
      label: tag.tagName,
    }))

    if (
      query &&
      !exact &&
      query.length <= MAX_TAG_LEN &&
      !/\s/.test(query)
    ) {
      items.push({
        type: 'create',
        tagName: query,
        label: `新建标签「${query}」`,
      })
    }

    return items
  })

  const loadTags = async () => {
    tagsLoading.value = true
    try {
      const data = await fetchAllTags()
      tags.value = (data || []).map((item) => ({
        tagId: String(item.tagId ?? ''),
        tagName: item.tagName || '',
      }))
    } catch {
      tags.value = []
    } finally {
      tagsLoading.value = false
    }
  }

  const closeMenu = () => {
    menuOpen.value = false
    hashState.value = null
    selectedIndex.value = 0
    lastQuery = ''
    menuStyle.value = { left: '0px', top: '0px', visibility: 'hidden' }
  }

  const positionMenu = async () => {
    const textarea = getTextarea()
    const state = hashState.value
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
      const menuEl = document.querySelector(`.${MENU_CLASS}[data-tag-hash-menu]`)
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

  const syncMenu = async () => {
    const textarea = getTextarea()
    if (!textarea) {
      closeMenu()
      return
    }

    const state = getHashTriggerState(getText(), textarea.selectionStart)
    if (!state) {
      closeMenu()
      return
    }

    hashState.value = state
    menuOpen.value = true
    if (state.query !== lastQuery) {
      selectedIndex.value = 0
      lastQuery = state.query
    }
    if (selectedIndex.value >= filteredItems.value.length) {
      selectedIndex.value = Math.max(0, filteredItems.value.length - 1)
    }
    await positionMenu()
  }

  const removeHashToken = () => {
    const state = hashState.value
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

  const applyItem = async (item) => {
    if (!item) return

    let tagId = item.tagId
    let tagName = item.tagName

    if (item.type === 'create') {
      try {
        const created = await createTag(item.tagName)
        tagId = String(created.tagId ?? '')
        tagName = created.tagName || item.tagName
        await loadTags()
      } catch {
        return
      }
    }

    removeHashToken()
    onTagSelected?.({ tagId, tagName })
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
      selectedIndex.value = (selectedIndex.value + 1) % filteredItems.value.length
      return true
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedIndex.value =
        (selectedIndex.value - 1 + filteredItems.value.length) %
        filteredItems.value.length
      return true
    }

    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault()
      selectCurrent()
      return true
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      removeHashToken()
      return true
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      selectCurrent()
      return true
    }

    return false
  }

  onBeforeUnmount(closeMenu)

  return {
    tagsLoading,
    menuOpen,
    menuStyle,
    selectedIndex,
    filteredItems,
    loadTags,
    syncMenu,
    closeMenu,
    applyItem,
    handleKeyDown,
    onMenuMouseDown,
    onTextareaBlur,
    removeHashToken,
  }
}
