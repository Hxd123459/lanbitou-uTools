<template>
  <div class="floating-input-bar">
    <div class="mode-row">
      <ModeToggle :model-value="mode" @update:model-value="onModeChange" />
      <span class="mode-tip">Tab 切换模式</span>
    </div>

    <div class="input-shell">
      <input
        :value="modelValue"
        class="main-input"
        :placeholder="placeholderText"
        @input="onInput"
        @keydown.enter="onSubmit"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ModeToggle from '../mode/ModeToggle.vue'

const props = defineProps({
  mode: {
    type: String,
    default: 'note',
  },
  modelValue: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:mode', 'update:modelValue', 'submit'])

const placeholderText = computed(() =>
  props.mode === 'note'
    ? '记录此刻想法，按 Enter 保存'
    : '输入你的问题，按 Enter 提问',
)

const onModeChange = (nextMode) => {
  emit('update:mode', nextMode)
}

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
}

const onSubmit = () => {
  const text = props.modelValue.trim()
  if (!text) return
  emit('submit', text)
}
</script>

<style scoped>
.floating-input-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.mode-tip {
  color: var(--color-secondary-text);
  font-size: 12px;
}

.input-shell {
  height: 56px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.input-shell:focus-within {
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring), var(--shadow-float);
}

.main-input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text);
  padding: 0 18px;
  font-size: 15px;
}

.main-input::placeholder {
  color: #71717a;
}
</style>
