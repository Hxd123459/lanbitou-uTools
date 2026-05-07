<template>
  <div class="input-bar" :class="{ 'is-submitting': submitting }">
    <div class="input-shell">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="main-input"
        :disabled="submitting"
        :placeholder="placeholder"
        rows="1"
        @input="onInput"
        @keydown="onKeydown"
      />
      <div class="input-footer">
        <span class="hint">
          <kbd>{{ shortcutLabel }}</kbd>
          <span class="hint-plus">+</span>
          <kbd>Enter</kbd>
          <span class="hint-text">保存</span>
        </span>
        <span v-if="submitting" class="status">提交中…</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '记录此刻想法',
  },
})

const emit = defineEmits(['update:modelValue', 'submit'])

const MAX_HEIGHT = 280
const textareaRef = ref(null)
const isMac = ref(false)

const shortcutLabel = computed(() => (isMac.value ? '⌘' : 'Ctrl'))

const adjustHeight = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(el.scrollHeight, MAX_HEIGHT)
  el.style.height = `${next}px`
}

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
  nextTick(adjustHeight)
}

const onKeydown = (event) => {
  if (event.isComposing) return
  if (event.key !== 'Enter') return
  const modifierPressed = isMac.value ? event.metaKey : event.ctrlKey
  if (!modifierPressed) return
  event.preventDefault()
  onSubmit()
}

const onSubmit = () => {
  if (props.submitting) return
  if (!props.modelValue.trim()) return
  emit('submit', props.modelValue)
}

watch(
  () => props.modelValue,
  () => nextTick(adjustHeight),
)

onMounted(() => {
  const platform =
    (typeof navigator !== 'undefined' &&
      (navigator.userAgentData?.platform || navigator.platform || '')) ||
    ''
  isMac.value = /Mac|iPhone|iPad|iPod/i.test(platform)
  nextTick(adjustHeight)
})
</script>

<style scoped>
.input-bar {
  display: flex;
  flex-direction: column;
}

.input-shell {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition: border-color var(--motion-fast),
    box-shadow var(--motion-fast);
}

.input-shell:focus-within {
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring), var(--shadow-float);
}

.is-submitting .input-shell {
  opacity: 0.85;
}

.main-input {
  width: 100%;
  min-height: 56px;
  max-height: 280px;
  height: 56px;
  border: 0;
  outline: 0;
  resize: none;
  overflow-y: auto;
  background: transparent;
  color: var(--color-text);
  padding: 14px 16px 6px;
  font-size: 15px;
  line-height: 1.55;
  font-family: inherit;
  scrollbar-width: none;
}

.main-input::-webkit-scrollbar {
  display: none;
}

.main-input::placeholder {
  color: #a1a1aa;
}

.main-input:disabled {
  cursor: not-allowed;
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px 10px;
  color: var(--color-secondary-text);
  font-size: 12px;
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.hint-plus {
  color: #a1a1aa;
}

.hint-text {
  margin-left: 2px;
}

.hint kbd {
  display: inline-block;
  min-width: 22px;
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}

.status {
  color: var(--color-accent);
  font-weight: 500;
}
</style>
