<template>
  <div class="input-bar" :class="{ 'is-submitting': submitting }">
    <div class="input-shell">
      <textarea
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
          <kbd>Enter</kbd> 保存 ·
          <kbd>Shift</kbd> + <kbd>Enter</kbd> 换行
        </span>
        <span v-if="submitting" class="status">提交中…</span>
      </div>
    </div>
  </div>
</template>

<script setup>
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
    default: '记录此刻想法，按 Enter 保存',
  },
})

const emit = defineEmits(['update:modelValue', 'submit'])

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
}

const onKeydown = (event) => {
  if (event.isComposing || event.key !== 'Enter') return
  if (event.shiftKey) return
  event.preventDefault()
  onSubmit()
}

const onSubmit = () => {
  if (props.submitting) return
  if (!props.modelValue.trim()) return
  emit('submit', props.modelValue)
}
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
    box-shadow var(--motion-fast),
    transform var(--motion-fast);
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
  max-height: 200px;
  border: 0;
  outline: 0;
  resize: none;
  overflow-y: auto;
  background: transparent;
  color: var(--color-text);
  padding: 14px 16px 4px;
  font-size: 15px;
  line-height: 1.55;
  font-family: inherit;
  transition: min-height var(--motion-fast);
}

.input-shell:focus-within .main-input {
  min-height: 112px;
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

.hint kbd {
  display: inline-block;
  min-width: 18px;
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
