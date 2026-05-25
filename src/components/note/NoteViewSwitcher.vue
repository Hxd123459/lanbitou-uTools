<template>
  <div class="note-view-switcher">
    <div class="switcher-tabs" role="tablist" aria-label="笔记视图">
      <motion.button
        v-for="item in modes"
        :key="item.id"
        type="button"
        class="switcher-btn"
        :class="{ 'is-active': modelValue === item.id }"
        role="tab"
        :aria-selected="modelValue === item.id"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="$emit('update:modelValue', item.id)"
      >
        <span class="switcher-icon" aria-hidden="true">
          <svg
            v-if="item.id === 'list'"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span>{{ item.label }}</span>
      </motion.button>
    </div>

    <div class="switcher-search-area">
      <AnimatePresence mode="wait" :initial="false">
        <motion.button
          v-if="!searchExpanded"
          key="search-toggle"
          type="button"
          class="switcher-search-toggle"
          :class="{ 'has-query': hasDraft }"
          aria-label="搜索笔记"
          :initial="searchToggleMotion.initial"
          :animate="searchToggleMotion.animate"
          :exit="searchToggleMotion.exit"
          :transition="searchToggleMotion.transition"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          @click="openSearch"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </motion.button>

        <motion.label
          v-else
          key="search-field"
          class="switcher-search"
          :initial="searchFieldMotion.initial"
          :animate="searchFieldMotion.animate"
          :exit="searchFieldMotion.exit"
          :transition="searchFieldMotion.transition"
        >
          <span class="switcher-search-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            ref="searchInputRef"
            type="search"
            class="switcher-search-input"
            :value="draftQuery"
            placeholder="搜索笔记…"
            autocomplete="off"
            spellcheck="false"
            aria-label="搜索笔记"
            @input="onDraftInput"
            @blur="onSearchBlur"
          />
        </motion.label>
      </AnimatePresence>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

const SEARCH_DEBOUNCE_MS = 400

defineProps({
  modelValue: {
    type: String,
    default: 'list',
  },
})

const emit = defineEmits(['update:modelValue', 'search'])

const { presets } = useMotionPresets()

const modes = [
  { id: 'list', label: '列表' },
  { id: 'tags', label: '标签' },
]

const draftQuery = ref('')
const searchExpanded = ref(false)
const searchInputRef = ref(null)
let debounceTimer = null

const hasDraft = computed(() => draftQuery.value.trim().length > 0)

const searchToggleMotion = computed(() => ({
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: presets.value.fast,
}))

const searchFieldMotion = computed(() => ({
  initial: { opacity: 0, width: 28 },
  animate: { opacity: 1, width: 200 },
  exit: { opacity: 0, width: 28 },
  transition: presets.value.fast,
}))

const emitSearch = (keyword) => {
  emit('search', keyword.trim())
}

const scheduleSearch = () => {
  clearTimeout(debounceTimer)
  const keyword = draftQuery.value.trim()
  if (!keyword) {
    emitSearch('')
    return
  }
  debounceTimer = window.setTimeout(() => emitSearch(keyword), SEARCH_DEBOUNCE_MS)
}

const onDraftInput = (event) => {
  draftQuery.value = event.target.value
  scheduleSearch()
}

const openSearch = () => {
  searchExpanded.value = true
  nextTick(() => searchInputRef.value?.focus())
}

const onSearchBlur = () => {
  searchExpanded.value = false
}

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
})
</script>

<style scoped>
.note-view-switcher {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
}

.switcher-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 1 auto;
  min-width: 0;
}

.switcher-search-area {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
  min-width: 28px;
  overflow: hidden;
}

.switcher-search-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.switcher-search-toggle:hover {
  color: var(--color-text);
  background: rgba(24, 24, 27, 0.06);
}

.switcher-search-toggle.has-query {
  color: var(--color-accent);
}

.switcher-search {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.04);
  cursor: text;
  overflow: hidden;
  box-sizing: border-box;
}

.switcher-search:focus-within {
  background: rgba(24, 24, 27, 0.07);
}

.switcher-search-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-secondary-text);
}

.switcher-search-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  outline: none;
}

.switcher-search-input::placeholder {
  color: #a1a1aa;
  font-weight: 400;
}

.switcher-search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.switcher-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-secondary-text);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
}

.switcher-btn:hover:not(.is-active) {
  color: var(--color-text);
}

.switcher-btn.is-active {
  color: var(--color-accent);
  font-weight: 600;
}

.switcher-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
