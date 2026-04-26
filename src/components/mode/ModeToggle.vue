<template>
  <div class="mode-toggle" role="tablist" aria-label="输入模式切换">
    <button
      class="mode-button"
      :class="{ active: modelValue === 'note' }"
      type="button"
      role="tab"
      :aria-selected="modelValue === 'note'"
      @click="onSelect('note')"
    >
      记
    </button>
    <button
      class="mode-button"
      :class="{ active: modelValue === 'ask' }"
      type="button"
      role="tab"
      :aria-selected="modelValue === 'ask'"
      @click="onSelect('ask')"
    >
      问
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: String,
    default: 'note',
  },
})

const emit = defineEmits(['update:modelValue'])

const onSelect = (mode) => {
  if (mode === props.modelValue) return
  emit('update:modelValue', mode)
}
</script>

<style scoped>
.mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
}

.mode-button {
  height: 30px;
  min-width: 46px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  color: var(--color-primary);
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--motion-fast), background-color var(--motion-fast);
}

.mode-button.active {
  color: #fff;
  background: var(--color-accent);
}
</style>
