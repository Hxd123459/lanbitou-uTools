<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="global-search-modal"
        class="global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        :initial="modalMotion.initial"
        :animate="modalMotion.animate"
        :exit="modalMotion.exit"
        :transition="modalMotion.transition"
      >
        <div class="global-search-body">
          <div class="global-search-toolbar">
            <motion.button
              type="button"
              class="global-search-close"
              aria-label="关闭搜索"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emitClose"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </motion.button>

            <div class="global-search-toolbar-main">
              <GlobalSearchQueryBar
                ref="queryBarRef"
                :active="visible"
                compact
                clear-on-inactive
                :scopes="resolvedScopes"
              />
            </div>
          </div>

          <div class="global-search-filters">
            <div class="global-search-scope" role="tablist" aria-label="搜索范围">
              <button
                v-for="item in scopeOptions"
                :key="item.id"
                type="button"
                class="global-search-scope-btn"
                :class="{ 'is-active': scope === item.id }"
                role="tab"
                :aria-selected="scope === item.id"
                @click="scope = item.id"
              >
                {{ item.label }}
              </button>
            </div>
            <span class="global-search-results-count">
              <template v-if="loading">搜索中…</template>
              <template v-else-if="hasQueried">共 {{ total }} 条</template>
            </span>
          </div>

          <div
            ref="resultsRef"
            class="global-search-results"
            @scroll="onResultsScroll"
          >
            <p v-if="searchError" class="global-search-state global-search-state--error">
              {{ searchError }}
            </p>
            <p
              v-else-if="hasQueried && !loading && !results.length"
              class="global-search-state"
            >
              未找到匹配内容，试试减少关键词或放宽筛选
            </p>

            <template v-for="item in results" :key="`${item.type}-${item.id}`">
              <!-- 碎片：直接展示全文 + 高亮 -->
              <article
                v-if="item.type === 'fragment'"
                class="global-search-result is-fragment"
              >
                <div class="global-search-result-meta">
                  <div class="global-search-result-meta-left">
                    <span class="global-search-result-icon is-fragment" title="碎片" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 5.5h7v7H4z" />
                        <path d="M15 4h5v5.5L16.5 14H13V8.5L15 4z" />
                        <path d="M8 15.5h7v5.5H8z" />
                      </svg>
                    </span>
                    <span v-if="resultTagLabel(item)" class="global-search-result-tag">
                      {{ resultTagLabel(item) }}
                    </span>
                  </div>
                  <span v-if="item.createTime" class="global-search-result-time">
                    {{ formatTime(item.createTime) }}
                  </span>
                </div>
                <div
                  class="global-search-result-full"
                  v-html="highlightText(item.content || '')"
                />
              </article>

              <!-- 沉淀：摘要 + 点击打开详情 -->
              <button
                v-else
                type="button"
                class="global-search-result is-sediment"
                @click="openSedimentDetail(item)"
              >
                <div class="global-search-result-meta">
                  <div class="global-search-result-meta-left">
                    <span class="global-search-result-icon is-sediment" title="沉淀" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2 2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </span>
                    <span v-if="item.title" class="global-search-result-tag">
                      {{ item.title }}
                    </span>
                  </div>
                  <span v-if="item.createTime" class="global-search-result-time">
                    {{ formatTime(item.createTime) }}
                  </span>
                </div>
                <div
                  v-if="resultSnippets(item).length"
                  class="global-search-result-snippets"
                >
                  <p
                    v-for="(snippet, snippetIndex) in resultSnippets(item)"
                    :key="`${item.id}-${snippetIndex}`"
                    class="global-search-result-snippet"
                    v-html="highlightText(snippet)"
                  />
                </div>
              </button>
            </template>

            <p v-if="loadingMore" class="global-search-state">加载更多…</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>

  <StructNoteViewModal
    :visible="sedimentVisible"
    :note-item="sedimentNoteItem"
    elevated
    @close="closeSedimentDetail"
    @error="onSedimentError"
  />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { highlightPlainText } from '../../utils/searchHighlight'
import { findStructFolderItemByNoteId } from '../../api/structNote'
import StructNoteViewModal from '../sediment/StructNoteViewModal.vue'
import GlobalSearchQueryBar from './GlobalSearchQueryBar.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { presets, reduced } = useMotionPresets()

const scopeOptions = [
  { id: 'all', label: '全部' },
  { id: 'fragment', label: '碎片' },
  { id: 'sediment', label: '沉淀' },
]

const scope = ref('all')
const queryBarRef = ref(null)
const resultsRef = ref(null)
const highlightKeywords = ref([])

const sedimentVisible = ref(false)
const sedimentNoteItem = ref(null)

const query = computed(() => queryBarRef.value?.query ?? null)
const results = computed(() => query.value?.results.value ?? [])
const total = computed(() => query.value?.total.value ?? 0)
const loading = computed(() => query.value?.loading.value ?? false)
const loadingMore = computed(() => query.value?.loadingMore.value ?? false)
const searchError = computed(() => query.value?.searchError.value ?? '')
const hasQueried = computed(() => query.value?.hasQueried.value ?? false)

const modalEase = [0.22, 1, 0.36, 1]

const modalMotion = computed(() => {
  if (reduced.value) {
    return { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
  }
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
    transition: { duration: 0.24, ease: modalEase },
  }
})

const resolvedScopes = computed(() => {
  if (scope.value === 'fragment') return ['fragment']
  if (scope.value === 'sediment') return ['sediment']
  return ['fragment', 'sediment']
})

const formatTime = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const resultTagLabel = (item) => item.tagName || (item.type === 'fragment' ? item.title : '') || ''

const resultSnippets = (item) => {
  if (Array.isArray(item.snippets) && item.snippets.length) return item.snippets
  if (item.snippet) return [item.snippet]
  return []
}

const highlightText = (text) => highlightPlainText(text, highlightKeywords.value)

const syncHighlightKeywords = () => {
  const list = queryBarRef.value?.query?.keywords?.value
  highlightKeywords.value = Array.isArray(list) ? [...list] : []
}

const closeSedimentDetail = () => {
  sedimentVisible.value = false
  sedimentNoteItem.value = null
}

const openSedimentDetail = async (item) => {
  if (!item?.id) return
  const noteId = item.noteId || item.id
  const title = item.title || '无标题'
  try {
    const folderItem = await findStructFolderItemByNoteId(noteId)
    sedimentNoteItem.value = folderItem || {
      type: 'note',
      id: noteId,
      noteId,
      name: title,
    }
  } catch {
    sedimentNoteItem.value = {
      type: 'note',
      id: noteId,
      noteId,
      name: title,
    }
  }
  sedimentVisible.value = true
}

const onSedimentError = (error) => {
  console.error('[烂笔头] 全局搜索打开沉淀失败', error)
}

const emitClose = () => {
  if (loading.value || loadingMore.value) return
  if (sedimentVisible.value) return
  emit('close')
}

const onResultsScroll = () => {
  query.value?.loadMoreIfNearBottom(resultsRef.value)
}

const onKeydown = (event) => {
  if (!props.visible || loading.value) return
  if (sedimentVisible.value) return
  if (event.key !== 'Escape') return
  event.preventDefault()
  emit('close')
}

watch(
  () => queryBarRef.value?.query?.keywords?.value,
  () => syncHighlightKeywords(),
  { deep: true },
)

watch(
  results,
  () => syncHighlightKeywords(),
)

watch(
  () => props.visible,
  (open) => {
    if (open) {
      scope.value = 'all'
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
      closeSedimentDetail()
      highlightKeywords.value = []
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

const applySearchText = async (text) => {
  await nextTick()
  queryBarRef.value?.applySearchText?.(text)
  await nextTick()
  syncHighlightKeywords()
}

defineExpose({
  applySearchText,
  focus: () => queryBarRef.value?.focus?.(),
})
</script>

<style scoped>
.global-search-modal {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.global-search-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(960px, calc(100% - 32px));
  margin: 0 auto;
  padding: 12px 20px 16px;
  gap: 10px;
  box-sizing: border-box;
}

.global-search-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.global-search-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
  cursor: pointer;
  flex-shrink: 0;
  box-sizing: border-box;
}

.global-search-close:hover {
  background: rgba(24, 24, 27, 0.1);
  color: var(--color-text);
}

.global-search-toolbar-main {
  flex: 1;
  min-width: 0;
}

.global-search-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 14px;
  flex-shrink: 0;
}

.global-search-scope {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.05);
}

.global-search-scope-btn {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.global-search-scope-btn.is-active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.08);
}

.global-search-results-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.global-search-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.global-search-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: left;
  color: inherit;
  font: inherit;
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.global-search-result.is-sediment {
  cursor: pointer;
}

.global-search-result.is-fragment {
  cursor: default;
}

.global-search-result:hover {
  border-color: rgba(24, 24, 27, 0.18);
  box-shadow: var(--shadow-card);
}

.global-search-result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.global-search-result-meta-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.global-search-result-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--color-secondary-text);
}

.global-search-result-icon.is-fragment {
  color: var(--color-accent);
}

.global-search-result-icon.is-sediment {
  color: #7c3aed;
}

.global-search-result-tag {
  display: inline-block;
  max-width: 220px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.global-search-result-full {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.global-search-result-full :deep(mark.note-highlight),
.global-search-result-snippet :deep(mark.note-highlight) {
  background: rgba(37, 99, 235, 0.16);
  color: var(--color-accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
  margin: 0 -1px;
}

.global-search-result-snippets {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.global-search-result-snippet {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.03);
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.global-search-result-time {
  flex: 0 0 auto;
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.global-search-state {
  margin: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.global-search-state--error {
  color: var(--color-error);
}

@media (max-width: 720px) {
  .global-search-body {
    width: calc(100% - 24px);
    padding: 10px 12px 14px;
  }

  .global-search-filters {
    gap: 8px;
  }

  .global-search-scope {
    width: 100%;
    justify-content: space-between;
  }

  .global-search-scope-btn {
    flex: 1;
    padding: 0 8px;
  }

  .global-search-results-count {
    width: 100%;
    text-align: right;
  }
}
</style>
