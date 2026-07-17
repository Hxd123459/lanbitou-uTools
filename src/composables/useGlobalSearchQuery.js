import { computed, nextTick, ref, watch } from 'vue'
import { searchGlobal } from '../api/globalSearch'
import { useTagHashPicker } from './useTagHashPicker'

export function useGlobalSearchQuery(options = {}) {
  const {
    scopes = ['fragment', 'sediment'],
    pageSize = 30,
    queryWithoutFilters = false,
  } = options

  const draftKeyword = ref('')
  const keywords = ref([])
  const selectedTag = ref(null)
  const dateFrom = ref('')
  const dateTo = ref('')

  const results = ref([])
  const total = ref(0)
  const pageNo = ref(0)
  const hasMore = ref(false)
  const loading = ref(false)
  const loadingMore = ref(false)
  const searchError = ref('')
  const hasQueried = ref(false)

  const keywordInputRef = ref(null)

  let searchToken = 0
  let searchTimer = null

  const hasDateRange = computed(() => Boolean(dateFrom.value && dateTo.value))

  const resolvedScopes = computed(() => {
    const list = Array.isArray(scopes)
      ? scopes
      : typeof scopes === 'function'
        ? scopes()
        : typeof scopes?.value !== 'undefined'
          ? scopes.value
          : ['fragment', 'sediment']
    return list.length ? list : ['fragment', 'sediment']
  })

  const {
    menuOpen: tagMenuOpen,
    menuStyle: tagMenuStyle,
    selectedIndex: tagMenuIndex,
    filteredItems: tagMenuItems,
    tagsLoading: tagMenuLoading,
    loadTags,
    syncMenu: syncTagMenu,
    closeMenu: closeTagMenu,
    applyItem: applyTagMenuItem,
    handleKeyDown: handleTagMenuKeyDown,
    onMenuMouseDown: onTagMenuMouseDown,
    onTextareaBlur: onTagTextareaBlur,
  } = useTagHashPicker({
    getText: () => draftKeyword.value,
    setText: (value) => {
      draftKeyword.value = value
    },
    getTextarea: () => keywordInputRef.value,
    onTagSelected: (tag) => {
      selectedTag.value = tag
      scheduleSearch(true)
    },
  })

  const shouldRunSearch = () => {
    if (queryWithoutFilters) return true
    return (
      keywords.value.length > 0 ||
      selectedTag.value?.tagId ||
      hasDateRange.value
    )
  }

  const buildSearchParams = (page) => ({
    keywords: keywords.value,
    tagId: selectedTag.value?.tagId || null,
    dateFrom: dateFrom.value || null,
    dateTo: dateTo.value || null,
    scopes: resolvedScopes.value,
    page,
    pageSize,
  })

  const resetState = () => {
    draftKeyword.value = ''
    keywords.value = []
    selectedTag.value = null
    dateFrom.value = ''
    dateTo.value = ''
    results.value = []
    total.value = 0
    pageNo.value = 0
    hasMore.value = false
    loading.value = false
    loadingMore.value = false
    searchError.value = ''
    hasQueried.value = false
    closeTagMenu()
  }

  const clearSelectedTag = () => {
    selectedTag.value = null
    scheduleSearch(true)
  }

  const clearDateRange = () => {
    dateFrom.value = ''
    dateTo.value = ''
    scheduleSearch(true)
  }

  const addKeyword = () => {
    const next = draftKeyword.value.trim()
    if (!next || next.startsWith('#')) return
    if (!keywords.value.includes(next)) {
      keywords.value = [...keywords.value, next]
    }
    draftKeyword.value = ''
    closeTagMenu()
    scheduleSearch(true)
  }

  /** 用一段文本覆盖关键词并搜索（空格分词，与 mainPush / 子输入框一致） */
  const applySearchText = (text) => {
    const parts = [
      ...new Set(
        String(text ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean),
      ),
    ]
    draftKeyword.value = ''
    keywords.value = parts
    closeTagMenu()
    scheduleSearch(true)
  }

  const removeKeyword = (index) => {
    keywords.value = keywords.value.filter((_, i) => i !== index)
    scheduleSearch(true)
  }

  const onKeywordInput = (event) => {
    draftKeyword.value = event.target.value
    nextTick(() => syncTagMenu())
  }

  const onKeywordFocus = () => {
    nextTick(() => syncTagMenu())
  }

  const onCaretChange = () => {
    nextTick(() => syncTagMenu())
  }

  const onKeywordKeydown = (event) => {
    if (event.isComposing) return
    if (handleTagMenuKeyDown(event)) return
    if (event.key === 'Enter') {
      event.preventDefault()
      addKeyword()
      return
    }
    if (event.key === 'Backspace' && !draftKeyword.value && keywords.value.length) {
      keywords.value = keywords.value.slice(0, -1)
      scheduleSearch(true)
    }
  }

  const runSearch = async ({ reset = false } = {}) => {
    if (!shouldRunSearch()) {
      results.value = []
      total.value = 0
      pageNo.value = 0
      hasMore.value = false
      hasQueried.value = false
      searchError.value = ''
      return
    }

    const myToken = ++searchToken
    const page = reset ? 1 : pageNo.value + 1
    if (reset) {
      loading.value = true
      searchError.value = ''
    } else {
      loadingMore.value = true
    }

    try {
      const data = await searchGlobal(buildSearchParams(page))
      if (myToken !== searchToken) return
      hasQueried.value = true
      if (reset) {
        results.value = data.records || []
      } else {
        const existing = new Set(results.value.map((item) => `${item.type}-${item.id}`))
        const next = (data.records || []).filter(
          (item) => !existing.has(`${item.type}-${item.id}`),
        )
        results.value = [...results.value, ...next]
      }
      total.value = data.total ?? results.value.length
      pageNo.value = data.pageNo ?? page
      hasMore.value = data.hasMore ?? false
    } catch (error) {
      if (myToken !== searchToken) return
      searchError.value = error?.message || '搜索失败，请稍后重试'
      if (reset) results.value = []
    } finally {
      if (myToken === searchToken) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  const scheduleSearch = (reset = true) => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      searchTimer = null
      runSearch({ reset })
    }, reset ? 180 : 0)
  }

  const loadMoreIfNearBottom = (el) => {
    if (!el || loading.value || loadingMore.value || !hasMore.value) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      runSearch({ reset: false })
    }
  }

  const dispose = () => {
    searchToken += 1
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    resetState()
  }

  watch([dateFrom, dateTo], () => scheduleSearch(true))

  return {
    draftKeyword,
    keywords,
    selectedTag,
    dateFrom,
    dateTo,
    results,
    total,
    pageNo,
    hasMore,
    loading,
    loadingMore,
    searchError,
    hasQueried,
    hasDateRange,
    keywordInputRef,
    tagMenuOpen,
    tagMenuStyle,
    tagMenuIndex,
    tagMenuItems,
    tagMenuLoading,
    loadTags,
    closeTagMenu,
    applyTagMenuItem,
    onTagMenuMouseDown,
    onTagTextareaBlur,
    resetState,
    clearSelectedTag,
    clearDateRange,
    addKeyword,
    applySearchText,
    removeKeyword,
    onKeywordInput,
    onKeywordFocus,
    onCaretChange,
    onKeywordKeydown,
    runSearch,
    scheduleSearch,
    loadMoreIfNearBottom,
    dispose,
  }
}
