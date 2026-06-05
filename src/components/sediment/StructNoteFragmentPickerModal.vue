<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="fragment-picker"
        class="fragment-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="选择碎片笔记"
        :initial="modalMotion.initial"
        :animate="modalMotion.animate"
        :exit="modalMotion.exit"
        :transition="modalMotion.transition"
      >
        <header class="fragment-picker-header">
          <h2 class="fragment-picker-title">选择碎片</h2>
          <div class="fragment-picker-header-actions">
            <motion.button
              type="button"
              class="btn btn-primary fragment-picker-confirm"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="handleConfirm"
            >
              确定{{ pickerSelectedIds.size ? `（${pickerSelectedIds.size}）` : '' }}
            </motion.button>
            <motion.button
              type="button"
              class="fragment-picker-close"
              aria-label="关闭"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emitClose"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </motion.button>
          </div>
        </header>

        <div class="fragment-picker-search-wrap">
          <svg class="fragment-picker-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref="searchInputRef"
            v-model="searchKeyword"
            class="fragment-picker-search"
            type="search"
            placeholder="搜索碎片笔记…"
            spellcheck="false"
            @keydown.esc.prevent="emitClose"
          />
        </div>

        <div
          ref="listRef"
          class="fragment-picker-list"
          @scroll="onListScroll"
        >
          <p v-if="loading && !list.length" class="fragment-picker-state">加载中…</p>
          <p v-else-if="!loading && !list.length" class="fragment-picker-state">
            {{ searchKeyword.trim() ? '未找到相关碎片' : '暂无碎片笔记' }}
          </p>

          <AnimatePresence mode="popLayout">
            <motion.div
              v-for="note in list"
              :key="note.id"
              class="fragment-picker-item"
              :initial="listItemMotion.initial"
              :animate="listItemMotion.animate"
              :exit="listItemMotion.exit"
              :transition="listItemMotion.transition"
              layout
            >
              <NoteCard
                :note="note"
                :highlight="searchKeyword.trim()"
                selectable
                :selected="isSelected(note.id)"
                @toggle-select="toggleSelect(note)"
              />
            </motion.div>
          </AnimatePresence>

          <p v-if="loadingMore" class="fragment-picker-state fragment-picker-state--more">加载更多…</p>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { NOTE_LIST_PAGE_SIZE, searchNotes } from '../../api/note'
import { useMotionPresets } from '../../composables/useMotionPresets'
import NoteCard from '../note/NoteCard.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  selectedNotes: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'confirm'])

const { presets, reduced } = useMotionPresets()

const searchKeyword = ref('')
const searchInputRef = ref(null)
const listRef = ref(null)
const list = ref([])
const noteById = ref(new Map())
const pickerSelectedIds = ref(new Set())
const loading = ref(false)
const loadingMore = ref(false)
let searchToken = 0

const searchState = reactive({
  pageNo: 0,
  hasMore: false,
})

const modalEase = [0.22, 1, 0.36, 1]

const modalMotion = computed(() => {
  if (reduced.value) {
    return { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
  }
  return {
    initial: { opacity: 0, y: 20, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 16, scale: 0.985 },
    transition: { duration: 0.26, ease: modalEase },
  }
})

const listItemMotion = computed(() => {
  if (reduced.value) {
    return { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
  }
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: presets.value.listItemExit,
    transition: { duration: 0.18, ease: 'easeOut' },
  }
})

const isSelected = (id) => pickerSelectedIds.value.has(id)

const syncSelectedFromProps = () => {
  const ids = new Set()
  const map = new Map()
  for (const note of props.selectedNotes) {
    if (!note?.id) continue
    ids.add(note.id)
    map.set(note.id, note)
  }
  pickerSelectedIds.value = ids
  noteById.value = map
}

const appendNotes = (notes) => {
  const existing = new Set(list.value.map((n) => n.id))
  const next = notes.filter((n) => n?.id && !existing.has(n.id))
  if (!next.length) return
  list.value = [...list.value, ...next]
  next.forEach((n) => noteById.value.set(n.id, n))
}

const runSearch = async ({ reset = true } = {}) => {
  if (!reset && !searchState.hasMore) return
  if (loading.value || loadingMore.value) return

  const myToken = ++searchToken
  const page = reset ? 1 : searchState.pageNo + 1
  if (reset) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const result = await searchNotes({
      keyword: searchKeyword.value.trim(),
      page,
      pageSize: NOTE_LIST_PAGE_SIZE,
    })
    if (myToken !== searchToken) return
    if (reset) {
      list.value = result.list
      result.list.forEach((n) => noteById.value.set(n.id, n))
    } else {
      appendNotes(result.list)
    }
    searchState.pageNo = result.pageNo
    searchState.hasMore = result.hasMore
  } catch {
    if (myToken !== searchToken) return
    if (reset) list.value = []
  } finally {
    if (myToken === searchToken) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

let searchDebounceTimer = null

const scheduleSearch = () => {
  if (searchDebounceTimer != null) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = window.setTimeout(() => {
    searchDebounceTimer = null
    runSearch({ reset: true })
  }, 280)
}

const onListScroll = () => {
  const el = listRef.value
  if (!el || loading.value || loadingMore.value || !searchState.hasMore) return
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  if (nearBottom) runSearch({ reset: false })
}

const toggleSelect = (note) => {
  if (!note?.id) return
  const next = new Set(pickerSelectedIds.value)
  if (next.has(note.id)) {
    next.delete(note.id)
  } else {
    next.add(note.id)
    noteById.value.set(note.id, note)
  }
  pickerSelectedIds.value = next
}

const handleConfirm = () => {
  const notes = [...pickerSelectedIds.value]
    .map((id) => noteById.value.get(id))
    .filter(Boolean)
  emit('confirm', notes)
}

const emitClose = () => emit('close')

const onKeydown = (event) => {
  if (!props.visible) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emitClose()
  }
}

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      syncSelectedFromProps()
      searchKeyword.value = ''
      list.value = []
      searchState.pageNo = 0
      searchState.hasMore = false
      await nextTick()
      searchInputRef.value?.focus()
      runSearch({ reset: true })
      window.addEventListener('keydown', onKeydown)
    } else {
      searchToken += 1
      loading.value = false
      loadingMore.value = false
      if (searchDebounceTimer != null) {
        clearTimeout(searchDebounceTimer)
        searchDebounceTimer = null
      }
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

watch(searchKeyword, () => {
  if (!props.visible) return
  scheduleSearch()
})

onBeforeUnmount(() => {
  if (searchDebounceTimer != null) clearTimeout(searchDebounceTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.fragment-picker-modal {
  position: fixed;
  inset: 0;
  z-index: 220;
  display: flex;
  flex-direction: column;
  background: #fbfaf9;
}

.fragment-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 12px;
  flex: 0 0 auto;
}

.fragment-picker-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.fragment-picker-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.fragment-picker-confirm {
  min-width: 88px;
}

.fragment-picker-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
  cursor: pointer;
}

.fragment-picker-close:hover {
  background: rgba(24, 24, 27, 0.1);
}

.fragment-picker-search-wrap {
  position: relative;
  flex: 0 0 auto;
  margin: 0 18px 12px;
}

.fragment-picker-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-secondary-text);
  pointer-events: none;
}

.fragment-picker-search {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px 10px 36px;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-primary);
  background: #fff;
  outline: none;
}

.fragment-picker-search:focus {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.fragment-picker-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 18px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fragment-picker-item {
  flex: 0 0 auto;
}

.fragment-picker-state {
  margin: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.fragment-picker-state--more {
  margin: 8px 0 0;
}
</style>
