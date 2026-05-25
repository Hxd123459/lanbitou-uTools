<template>
  <div class="note-view-switcher" role="tablist" aria-label="笔记视图">
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
</template>

<script setup>
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

defineProps({
  modelValue: {
    type: String,
    default: 'list',
  },
})

defineEmits(['update:modelValue'])

const { presets } = useMotionPresets()

const modes = [
  { id: 'list', label: '列表' },
  { id: 'tags', label: '标签' },
]
</script>

<style scoped>
.note-view-switcher {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
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
