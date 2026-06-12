<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="panelRef"
      class="bulk-tag-menu"
      :style="panelStyle"
      role="listbox"
      aria-label="选择标签"
      @mousedown.prevent
    >
      <label class="bulk-tag-menu-search">
        <span class="bulk-tag-menu-search-icon" aria-hidden="true">#</span>
        <input
          ref="searchInputRef"
          :value="filterQuery"
          type="text"
          class="bulk-tag-menu-search-input"
          placeholder="筛选或新建标签…"
          spellcheck="false"
          :disabled="creating"
          @input="onFilterInput"
          @keydown.enter.prevent="onSearchEnter"
          @keydown.esc.stop="emit('close')"
        />
        <button
          type="button"
          class="bulk-tag-menu-ai-btn"
          :disabled="creating || loading"
          aria-label="AI 自动打标"
          title="AI 自动打标"
          @click="emit('ai-tag')"
        >
          <svg
            viewBox="0 0 1024 1024"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M276.16 334.4c-20.544 14.72-44.352 25.6-91.712 47.168-29.76 13.504-45.248 20.672-50.112 29.824a32.64 32.64 0 0 0 0 30.592c4.864 9.152 20.352 16.32 50.112 29.824 47.36 21.568 71.168 32.384 91.712 47.104a256 256 0 0 1 58.048 58.112c14.72 20.48 25.6 44.352 47.168 91.712 13.504 29.76 20.672 45.248 29.824 50.112 9.472 5.12 21.12 5.12 30.592 0 9.152-4.864 16.32-20.352 29.824-50.112 21.568-47.36 32.384-71.168 47.168-91.712a256 256 0 0 1 58.048-58.048c20.48-14.784 44.352-25.6 91.712-47.168 29.76-13.568 45.248-20.672 50.112-29.824a32.64 32.64 0 0 0 0-30.592c-4.864-9.152-20.352-16.32-50.112-29.824-47.36-21.568-71.168-32.384-91.712-47.168a256 256 0 0 1-58.048-58.048c-14.784-20.544-25.6-44.352-47.168-91.712-13.504-29.76-20.672-45.248-29.824-50.112a32.64 32.64 0 0 0-30.592 0c-9.152 4.864-16.32 20.352-29.824 50.112-21.568 47.36-32.384 71.168-47.168 91.712a256 256 0 0 1-58.048 58.048z m409.216 392.32c-7.04 4.416-14.784 7.936-30.208 14.912-12.864 5.888-19.712 9.024-22.592 12.416a21.568 21.568 0 0 0 0 27.968c2.88 3.328 9.728 6.528 22.592 12.352 15.36 7.04 23.168 10.56 30.208 14.912 16.64 10.368 30.784 24.512 41.216 41.216 4.352 7.04 7.872 14.72 14.848 30.208 5.888 12.8 9.024 19.712 12.416 22.592a21.504 21.504 0 0 0 27.968 0c3.328-2.944 6.528-9.792 12.352-22.656 7.04-15.36 10.56-23.168 14.912-30.144 10.368-16.704 24.512-30.848 41.216-41.216 7.04-4.352 14.72-7.872 30.208-14.912 12.8-5.824 19.712-8.96 22.592-12.352a21.504 21.504 0 0 0 0-28.032c-2.88-3.328-9.728-6.464-22.592-12.352-15.424-7.04-23.232-10.496-30.208-14.848a128.064 128.064 0 0 1-41.216-41.28 274.112 274.112 0 0 1-14.912-30.144c-5.824-12.864-8.96-19.712-12.352-22.656a21.568 21.568 0 0 0-27.968 0c-3.392 2.944-6.528 9.792-12.416 22.656-7.04 15.36-10.496 23.168-14.848 30.144a128.064 128.064 0 0 1-41.216 41.216z" />
          </svg>
        </button>
      </label>

      <p v-if="loading" class="bulk-tag-menu-state">加载标签中…</p>
      <p v-else-if="creating" class="bulk-tag-menu-state">创建标签中…</p>
      <p v-else-if="!menuItems.length" class="bulk-tag-menu-state">输入标签名，最多 5 个字</p>
      <button
        v-for="(item, index) in menuItems"
        :key="`${item.type}-${item.tagId || item.tagName}-${index}`"
        type="button"
        class="bulk-tag-menu-item"
        :class="{ 'is-create': item.type === 'create' }"
        role="option"
        :disabled="creating"
        @click="onSelectItem(item)"
      >
        <span class="bulk-tag-menu-name">
          <template v-if="item.type === 'create'">{{ item.label }}</template>
          <template v-else>#{{ item.tagName }}</template>
        </span>
        <span v-if="item.type !== 'create'" class="bulk-tag-menu-count">
          {{ item.noteCount }}
        </span>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createTag, fetchAllTags } from '../../api/note'
import { invalidateTagList } from '../../composables/tagListSync'
import { clampTagNameInput, isTagNameWithinLimit } from '../../utils/tagName'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  anchorEl: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['select', 'close', 'ai-tag'])

const panelRef = ref(null)
const searchInputRef = ref(null)
const panelStyle = ref({ left: '0px', bottom: '0px' })
const loading = ref(false)
const creating = ref(false)
const tags = ref([])
const filterQuery = ref('')

const menuItems = computed(() => {
  const query = filterQuery.value.trim()
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
    noteCount: tag.noteCount,
  }))

  if (
    query &&
    !exact &&
    isTagNameWithinLimit(query) &&
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

const resolveAnchorEl = () => {
  const anchor = props.anchorEl
  if (!anchor) return null
  const raw = anchor instanceof HTMLElement ? anchor : anchor.value
  if (raw instanceof HTMLElement) return raw
  if (raw?.$el instanceof HTMLElement) return raw.$el
  return null
}

const updatePosition = async () => {
  await nextTick()
  const anchor = resolveAnchorEl()
  const panel = panelRef.value
  if (!anchor || !panel) return

  const rect = anchor.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const padding = 8
  const menuGap = 16
  const anchorCenterX = rect.left + rect.width / 2
  let left = anchorCenterX - panelRect.width / 2
  const bottom = window.innerHeight - rect.top + menuGap

  if (left < padding) {
    left = padding
  } else if (left + panelRect.width > window.innerWidth - padding) {
    left = Math.max(padding, window.innerWidth - panelRect.width - padding)
  }

  panelStyle.value = {
    left: `${left}px`,
    bottom: `${bottom}px`,
  }
}

const loadTags = async () => {
  loading.value = true
  try {
    const data = await fetchAllTags()
    tags.value = data.map((item) => ({
      tagId: String(item.tagId ?? ''),
      tagName: item.tagName || '未命名',
      noteCount: String(item.noteCount ?? '0'),
    }))
  } catch {
    tags.value = []
  } finally {
    loading.value = false
  }
}

const onFilterInput = (event) => {
  filterQuery.value = clampTagNameInput(event.target.value)
  void updatePosition()
}

const onSelectItem = async (item) => {
  if (creating.value || !item) return

  if (item.type === 'create') {
    creating.value = true
    try {
      const created = await createTag(item.tagName)
      invalidateTagList()
      emit('select', {
        tagId: String(created?.tagId ?? ''),
        tagName: created?.tagName || item.tagName,
      })
      emit('close')
    } catch (error) {
      console.warn('[烂笔头] 批量打标创建标签失败', error)
    } finally {
      creating.value = false
    }
    return
  }

  emit('select', {
    tagId: item.tagId,
    tagName: item.tagName,
  })
  emit('close')
}

const onSearchEnter = () => {
  const first = menuItems.value[0]
  if (first) void onSelectItem(first)
}

const onDocumentPointerDown = (event) => {
  if (!props.visible) return
  const panel = panelRef.value
  const anchor = resolveAnchorEl()
  if (panel?.contains(event.target) || anchor?.contains(event.target)) return
  emit('close')
}

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      filterQuery.value = ''
      creating.value = false
      await loadTags()
      await updatePosition()
      await nextTick()
      searchInputRef.value?.focus()
      document.addEventListener('pointerdown', onDocumentPointerDown)
      window.addEventListener('resize', updatePosition)
    } else {
      filterQuery.value = ''
      creating.value = false
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      window.removeEventListener('resize', updatePosition)
    }
  },
)

watch(menuItems, () => {
  if (props.visible) void updatePosition()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', updatePosition)
})
</script>

<style scoped>
.bulk-tag-menu {
  position: fixed;
  z-index: 230;
  min-width: 200px;
  max-width: min(280px, calc(100vw - 16px));
  max-height: min(360px, calc(100vh - 120px));
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-float, 0 16px 40px rgba(24, 24, 27, 0.12));
}

.bulk-tag-menu-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 2px 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.04);
}

.bulk-tag-menu-search:focus-within {
  background: rgba(24, 24, 27, 0.07);
  box-shadow: var(--focus-ring);
}

.bulk-tag-menu-search-icon {
  flex: 0 0 auto;
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 700;
}

.bulk-tag-menu-search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.bulk-tag-menu-search-input::placeholder {
  color: #a1a1aa;
}

.bulk-tag-menu-ai-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.bulk-tag-menu-ai-btn:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-accent);
}

.bulk-tag-menu-ai-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.bulk-tag-menu-state {
  margin: 8px 10px;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.bulk-tag-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.bulk-tag-menu-item:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
}

.bulk-tag-menu-item.is-create {
  color: var(--color-accent);
}

.bulk-tag-menu-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.bulk-tag-menu-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bulk-tag-menu-count {
  flex: 0 0 auto;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
}
</style>
