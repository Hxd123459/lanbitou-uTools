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
        <header class="global-search-header">
          <motion.button
            type="button"
            class="global-search-close"
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
          <h2 class="global-search-title">全局搜索</h2>
        </header>

        <div class="global-search-body">
          <GlobalSearchQueryBar
            ref="queryBarRef"
            :active="visible"
            clear-on-inactive
            :scopes="resolvedScopes"
          />

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
          </div>

          <div class="global-search-results-head">
            <span class="global-search-results-count">
              <template v-if="loading">搜索中…</template>
              <template v-else-if="hasQueried">共 {{ total }} 条结果</template>
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

            <button
              v-for="item in results"
              :key="`${item.type}-${item.id}`"
              type="button"
              class="global-search-result"
              @click="emitSelect(item)"
            >
              <div class="global-search-result-meta">
                <div class="global-search-result-meta-left">
                  <span
                    class="global-search-result-icon"
                    :class="`is-${item.type}`"
                    :title="item.type === 'fragment' ? '碎片' : '沉淀'"
                    aria-hidden="true"
                  >
                    <svg
                      v-if="item.type === 'fragment'"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 5.5h7v7H4z" />
                      <path d="M15 4h5v5.5L16.5 14H13V8.5L15 4z" />
                      <path d="M8 15.5h7v5.5H8z" />
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M12 2 2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
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
                v-if="resultSnippets(item).length"
                class="global-search-result-snippets"
              >
                <p
                  v-for="(snippet, snippetIndex) in resultSnippets(item)"
                  :key="`${item.type}-${item.id}-${snippetIndex}`"
                  class="global-search-result-snippet"
                  v-html="highlightSnippet(snippet)"
                />
              </div>
            </button>

            <p v-if="loadingMore" class="global-search-state">加载更多…</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { highlightPlainText } from '../../utils/searchHighlight'
import GlobalSearchQueryBar from './GlobalSearchQueryBar.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'select'])

const { presets, reduced } = useMotionPresets()

const scopeOptions = [
  { id: 'all', label: '全部' },
  { id: 'fragment', label: '碎片' },
  { id: 'sediment', label: '沉淀' },
]

const scope = ref('all')
const queryBarRef = ref(null)
const resultsRef = ref(null)

const query = computed(() => queryBarRef.value?.query ?? null)
const results = computed(() => query.value?.results.value ?? [])
const total = computed(() => query.value?.total.value ?? 0)
const loading = computed(() => query.value?.loading.value ?? false)
const loadingMore = computed(() => query.value?.loadingMore.value ?? false)
const searchError = computed(() => query.value?.searchError.value ?? '')
const hasQueried = computed(() => query.value?.hasQueried.value ?? false)
const keywords = computed(() => query.value?.keywords.value ?? [])

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

const hasMore = computed(() => query.value?.hasMore.value ?? false)

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

const highlightSnippet = (text) => highlightPlainText(text, keywords.value)

const emitClose = () => {
  if (loading.value || loadingMore.value) return
  emit('close')
}

const emitSelect = (item) => {
  emit('select', item)
}

const onResultsScroll = () => {
  query.value?.loadMoreIfNearBottom(resultsRef.value)
}

const onKeydown = (event) => {
  if (!props.visible || loading.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emitClose()
  }
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      scope.value = 'all'
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
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

.global-search-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
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
  color: var(--color-primary);
  cursor: pointer;
}

.global-search-close:hover {
  background: rgba(24, 24, 27, 0.1);
}

.global-search-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.global-search-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(960px, calc(100% - 32px));
  margin: 0 auto;
  padding: 20px 20px 24px;
  box-sizing: border-box;
}

.global-search-query {
  flex: 0 0 auto;
  margin-bottom: 14px;
}

.global-search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.global-search-input-row:focus-within {
  border-color: rgba(24, 24, 27, 0.28);
  box-shadow: var(--focus-ring), var(--shadow-card);
}

.global-search-input-icon {
  flex: 0 0 auto;
  color: var(--color-secondary-text);
}

.global-search-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  border: 0;
  outline: 0;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  color: var(--color-text);
}

.global-search-input::placeholder {
  color: #a1a1aa;
}

.global-search-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.global-search-chip,
.global-search-tag-chip,
.global-search-date-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
}

.global-search-date-chip {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.global-search-chip {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
}

.global-search-tag-chip {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-accent);
  font-weight: 600;
}

.global-search-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.global-search-chip-remove:hover {
  color: var(--color-primary);
  background: rgba(24, 24, 27, 0.08);
}

.global-search-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px 14px;
  margin-bottom: 14px;
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
}

.global-search-scope-btn.is-active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.08);
}

.global-search-results-head {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.global-search-results-count {
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
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
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
}

.global-search-result-snippet :deep(mark.note-highlight) {
  background: rgba(37, 99, 235, 0.16);
  color: var(--color-accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
  margin: 0 -1px;
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

.tag-hash-menu-state {
  margin: 0;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.tag-hash-menu-hash {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

@media (max-width: 720px) {
  .global-search-body {
    padding: 16px 14px 20px;
  }

  .global-search-filters {
    gap: 10px;
  }

  .global-search-scope {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }

  .global-search-scope-btn {
    flex: 1;
    padding: 0 8px;
  }
}
</style>
