<template>
  <div class="global-search-query" :class="{ 'is-compact': compact, 'is-panel-mode': panelMode }">
    <div
      class="global-search-input-row"
      @mousedown="onInputRowMouseDown"
    >
      <span class="global-search-input-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>

      <div class="global-search-input-fields" aria-label="搜索条件">
        <span v-if="selectedTag" class="global-search-tag-chip">
          #{{ selectedTag.tagName }}
          <button
            type="button"
            class="global-search-chip-remove"
            aria-label="移除标签筛选"
            @mousedown.prevent
            @click="clearSelectedTag"
          >
            ×
          </button>
        </span>
        <span v-if="hasDateRange" class="global-search-date-chip">
          {{ dateRangeLabel }}
          <button
            type="button"
            class="global-search-chip-remove"
            aria-label="移除日期筛选"
            @mousedown.prevent
            @click="clearDateRange"
          >
            ×
          </button>
        </span>
        <span
          v-for="(item, index) in keywords"
          :key="`${item}-${index}`"
          class="global-search-chip"
        >
          {{ item }}
          <button
            type="button"
            class="global-search-chip-remove"
            :aria-label="`移除关键词 ${item}`"
            @mousedown.prevent
            @click="removeKeyword(index)"
          >
            ×
          </button>
        </span>
        <input
          ref="keywordInputRef"
          :value="draftKeyword"
          type="text"
          class="global-search-input"
          :placeholder="inputPlaceholder"
          spellcheck="false"
          @input="onKeywordInput"
          @focus="onKeywordFocus"
          @blur="onTagTextareaBlur"
          @keydown="onKeywordKeydown"
          @click="onCaretChange"
          @keyup="onCaretChange"
        />
      </div>

      <DateRangePicker
        v-model:date-from="dateFrom"
        v-model:date-to="dateTo"
        compact
        :panel-compact="panelMode"
      />
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="tagMenuOpen"
      class="struct-note-slash-menu"
      :class="{ 'struct-note-slash-menu--panel': panelMode }"
      data-tag-hash-menu
      role="listbox"
      aria-label="选择标签"
      :style="tagMenuStyle"
      @mousedown="onTagMenuMouseDown"
    >
      <p v-if="tagMenuLoading" class="tag-hash-menu-state">加载标签中…</p>
      <p v-else-if="!tagMenuItems.length" class="tag-hash-menu-state">
        输入标签名，最多 5 个字
      </p>
      <button
        v-for="(menuItem, index) in tagMenuItems"
        :key="`${menuItem.type}-${menuItem.tagName}`"
        type="button"
        class="struct-note-slash-menu__item"
        :class="{ 'struct-note-slash-menu__item--active': index === tagMenuIndex }"
        role="option"
        :aria-selected="index === tagMenuIndex"
        @click="applyTagMenuItem(menuItem)"
      >
        <span class="struct-note-slash-menu__icon" aria-hidden="true">
          <svg
            v-if="menuItem.type === 'create'"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span v-else class="tag-hash-menu-hash">#</span>
        </span>
        <span class="struct-note-slash-menu__label">{{ menuItem.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGlobalSearchQuery } from '../../composables/useGlobalSearchQuery'
import DateRangePicker from '../common/DateRangePicker.vue'
import '../../assets/styles/tiptap-slash-menu.css'

const props = defineProps({
  compact: { type: Boolean, default: false },
  panelMode: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  scopes: {
    type: Array,
    default: () => ['fragment', 'sediment'],
  },
  queryWithoutFilters: { type: Boolean, default: false },
  clearOnInactive: { type: Boolean, default: false },
  placeholder: {
    type: String,
    default: '使用 # 选标签；输入关键词，Enter添加；右侧选日期',
  },
})

const emit = defineEmits(['results-change'])

const query = useGlobalSearchQuery({
  scopes: computed(() => props.scopes),
  queryWithoutFilters: props.queryWithoutFilters,
  pageSize: props.panelMode ? 20 : 30,
})

const tagsLoaded = ref(false)

const {
  draftKeyword,
  keywords,
  selectedTag,
  dateFrom,
  dateTo,
  results,
  hasDateRange,
  hasQueried,
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
  removeKeyword,
  applySearchText,
  onKeywordInput,
  onKeywordFocus,
  onCaretChange,
  onKeywordKeydown,
  runSearch,
  scheduleSearch,
  dispose,
} = query

const dateRangeLabel = computed(() => {
  if (!hasDateRange.value) return ''
  return `${dateFrom.value} ~ ${dateTo.value}`
})

const hasInlineFilters = computed(
  () => Boolean(keywords.value.length || selectedTag.value || hasDateRange.value),
)

const inputPlaceholder = computed(() =>
  hasInlineFilters.value ? '' : props.placeholder,
)

const onInputRowMouseDown = (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('button, input, .date-range-picker')) return
  event.preventDefault()
  keywordInputRef.value?.focus()
}

watch(
  results,
  (records) => emit('results-change', records),
  { deep: true },
)

watch(
  () => props.scopes,
  () => {
    if (props.active) scheduleSearch(true)
  },
)

watch(
  () => props.active,
  async (open) => {
    if (!open) {
      closeTagMenu()
      if (props.clearOnInactive) {
        dispose()
        tagsLoaded.value = false
      }
      return
    }
    if (!tagsLoaded.value) {
      await loadTags()
      tagsLoaded.value = true
    }
    if (!hasQueried.value) {
      await runSearch({ reset: true })
    }
    if (!props.panelMode) {
      await nextTick()
      // uTools 主窗口用顶部子输入框搜索，避免抢焦点
      const skipFocus =
        typeof window !== 'undefined' &&
        window.utools?.getWindowType?.() === 'main'
      if (!skipFocus) keywordInputRef.value?.focus()
    }
  },
)

onMounted(async () => {
  if (!tagsLoaded.value) {
    await loadTags()
    tagsLoaded.value = true
  }
  if (props.active && !hasQueried.value) {
    await runSearch({ reset: true })
  }
})

onBeforeUnmount(() => {
  dispose()
  tagsLoaded.value = false
})

defineExpose({
  query,
  focus: () => keywordInputRef.value?.focus(),
  applySearchText,
})
</script>

<style scoped>
.global-search-query {
  flex: 0 0 auto;
}

.global-search-query.is-compact {
  margin-bottom: 0;
}

.global-search-query:not(.is-compact) {
  margin-bottom: 14px;
}

.global-search-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 4px 8px 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fff;
  box-sizing: border-box;
  cursor: text;
}

.is-compact .global-search-input-row {
  min-height: 36px;
  padding: 3px 6px 3px 8px;
  border-radius: 10px;
}

.global-search-input-row:focus-within {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.global-search-input-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  color: var(--color-secondary-text);
}

.global-search-input-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.global-search-input {
  flex: 1 1 96px;
  min-width: 72px;
  height: 28px;
  margin: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 28px;
  color: var(--color-text);
}

.is-compact .global-search-input {
  height: 26px;
  font-size: 13px;
  line-height: 26px;
}

.global-search-input::placeholder {
  color: #a1a1aa;
}

.is-compact .global-search-input::placeholder {
  font-size: 12px;
}

.global-search-chip,
.global-search-tag-chip,
.global-search-date-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  padding: 2px 6px 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  box-sizing: border-box;
}

.is-compact .global-search-chip,
.is-compact .global-search-tag-chip,
.is-compact .global-search-date-chip {
  font-size: 11px;
  padding: 1px 5px 1px 7px;
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
  width: 14px;
  height: 14px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.global-search-chip-remove:hover {
  color: var(--color-primary);
  background: rgba(24, 24, 27, 0.08);
}
</style>
