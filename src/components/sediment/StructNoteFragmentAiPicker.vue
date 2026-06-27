<template>
  <div
    ref="rootRef"
    class="struct-note-fragment-ai-picker"
  >
    <button
      type="button"
      class="struct-note-fragment-ai-trigger"
      :class="{ 'is-active': Boolean(modelValue) }"
      :disabled="disabled || processing"
      :aria-expanded="menuOpen"
      aria-haspopup="listbox"
      aria-label="选择引入方式"
      :title="triggerTitle"
      @click="toggleMenu"
    >
      <svg
        class="struct-note-fragment-ai-trigger-icon"
        viewBox="0 0 1024 1024"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <path
          d="M729.6 128l47.616 87.978667 89.258667 46.933333-89.258667 46.933333L729.6 397.824l-47.616-87.978667-89.216-46.933333 89.216-46.933333L729.6 128z"
          fill="currentColor"
        />
        <path
          d="M404.778667 239.189333l96.213333 177.92L681.429333 512l-180.48 94.890667-96.256 177.92-96.256-177.92L128 512l180.48-94.890667 96.298667-177.92z"
          fill="currentColor"
        />
        <path
          d="M825.856 666.197333l-60.16-111.232-60.16 111.232-112.768 59.306667 112.768 59.306667L765.696 896l60.16-111.189333L938.666667 725.504l-112.810667-59.306667z"
          fill="currentColor"
        />
      </svg>
    </button>

    <div
      v-if="menuOpen"
      class="struct-note-fragment-ai-menu"
      role="listbox"
      aria-label="碎片引入方式"
    >
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        class="struct-note-fragment-ai-option"
        :class="{ 'is-selected': isOptionSelected(option.id) }"
        role="option"
        :aria-selected="isOptionSelected(option.id)"
        @click="selectOption(option.id)"
      >
        <span class="struct-note-fragment-ai-option-icon" aria-hidden="true">
          <svg
            class="struct-note-fragment-ai-option-icon-svg"
            viewBox="0 0 1024 1024"
            width="14"
            height="14"
          >
            <path
              d="M729.6 128l47.616 87.978667 89.258667 46.933333-89.258667 46.933333L729.6 397.824l-47.616-87.978667-89.216-46.933333 89.216-46.933333L729.6 128z"
              fill="currentColor"
            />
            <path
              d="M404.778667 239.189333l96.213333 177.92L681.429333 512l-180.48 94.890667-96.256 177.92-96.256-177.92L128 512l180.48-94.890667 96.298667-177.92z"
              fill="currentColor"
            />
            <path
              d="M825.856 666.197333l-60.16-111.232-60.16 111.232-112.768 59.306667 112.768 59.306667L765.696 896l60.16-111.189333L938.666667 725.504l-112.810667-59.306667z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span class="struct-note-fragment-ai-option-label">{{ option.label }}</span>
        <span
          v-if="isOptionSelected(option.id)"
          class="struct-note-fragment-ai-option-check"
          aria-hidden="true"
        >
          ✓
        </span>
      </button>

      <div class="struct-note-fragment-ai-menu-divider" aria-hidden="true" />

      <button
        type="button"
        class="struct-note-fragment-ai-option struct-note-fragment-ai-option--add"
        @click="handleAddTemplate"
      >
        <span class="struct-note-fragment-ai-option-icon struct-note-fragment-ai-option-icon--plus" aria-hidden="true">
          +
        </span>
        <span class="struct-note-fragment-ai-option-label">添加模版</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { FRAGMENT_INTRO_RAW } from '../../composables/useStructNoteFragments'
import { SEDIMENT_DRAFT_PRESETS } from '../../ai/sedimentDraftService'

const props = defineProps({
  modelValue: {
    type: String,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  processing: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const menuOpen = ref(false)
const rootRef = ref(null)

const options = computed(() => [
  { id: FRAGMENT_INTRO_RAW, label: '原文' },
  ...Object.values(SEDIMENT_DRAFT_PRESETS),
])

const isOptionSelected = (id) => {
  if (id === FRAGMENT_INTRO_RAW) return !props.modelValue
  return props.modelValue === id
}

const triggerTitle = computed(() => {
  if (props.processing) return 'AI 整理中…'
  if (!props.modelValue || props.modelValue === FRAGMENT_INTRO_RAW) {
    return '引入方式：原文（点击选择 AI 模板）'
  }
  const label = SEDIMENT_DRAFT_PRESETS[props.modelValue]?.label
  return label ? `引入方式：${label}` : '选择引入方式'
})

const closeMenu = () => {
  menuOpen.value = false
}

const toggleMenu = () => {
  if (props.disabled || props.processing) return
  menuOpen.value = !menuOpen.value
}

const selectOption = (id) => {
  const next = id === FRAGMENT_INTRO_RAW ? null : id
  emit('update:modelValue', next)
  closeMenu()
}

const handleAddTemplate = () => {
  // 预留：添加自定义模版
}

const handleDocumentPointerDown = (event) => {
  if (!menuOpen.value) return
  const root = rootRef.value
  if (root && event.target instanceof Node && root.contains(event.target)) return
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<style scoped>
.struct-note-fragment-ai-picker {
  position: relative;
}

.struct-note-fragment-ai-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #bfbfbf;
  cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease;
}

.struct-note-fragment-ai-trigger-icon {
  display: block;
  flex: 0 0 auto;
}

.struct-note-fragment-ai-trigger:hover:not(:disabled) {
  color: var(--color-accent);
  background: rgba(24, 24, 27, 0.06);
}

.struct-note-fragment-ai-trigger.is-active {
  color: #1d4ed8;
}

.struct-note-fragment-ai-trigger.is-active:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.08);
}

.struct-note-fragment-ai-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.struct-note-fragment-ai-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 12;
  min-width: 168px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(24, 24, 27, 0.08);
  background: #fff;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14);
}

.struct-note-fragment-ai-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.struct-note-fragment-ai-option:hover,
.struct-note-fragment-ai-option.is-selected {
  background: rgba(37, 99, 235, 0.08);
}

.struct-note-fragment-ai-option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 14px;
  color: #bfbfbf;
}

.struct-note-fragment-ai-option-icon-svg {
  display: block;
}

.struct-note-fragment-ai-option-icon--plus {
  font-size: 15px;
  font-weight: 500;
  line-height: 1;
  color: var(--color-secondary-text);
}

.struct-note-fragment-ai-menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: rgba(24, 24, 27, 0.08);
}

.struct-note-fragment-ai-option--add:hover {
  background: rgba(24, 24, 27, 0.05);
}

.struct-note-fragment-ai-option-label {
  flex: 1;
  min-width: 0;
}

.struct-note-fragment-ai-option-check {
  flex: 0 0 auto;
  font-size: 12px;
  color: #1d4ed8;
}
</style>
