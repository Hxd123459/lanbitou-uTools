<template>
  <motion.div
    class="note-bulk-bar"
    role="toolbar"
    aria-label="已选笔记操作"
    :initial="presets.reveal.initial"
    :animate="presets.reveal.animate"
    :transition="presets.reveal.transition"
  >
    <motion.button
      type="button"
      class="note-bulk-btn note-bulk-btn--clear"
      :disabled="busy"
      :while-hover="presets.button.hover"
      :while-tap="presets.button.tap"
      :transition="presets.button.transition"
      @click="$emit('clear')"
    >
      <span class="note-bulk-btn-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </span>
      <span class="note-bulk-btn-label">清空已选</span>
    </motion.button>
    <div class="note-bulk-actions">
      <motion.button
        type="button"
        class="note-bulk-btn"
        :disabled="busy"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="$emit('sediment')"
      >
        <span class="note-bulk-btn-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
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
        <span class="note-bulk-btn-label">去沉淀</span>
      </motion.button>
      <motion.button
        type="button"
        class="note-bulk-btn note-bulk-btn--danger"
        :disabled="busy"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="$emit('delete')"
      >
        <span class="note-bulk-btn-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </span>
        <span class="note-bulk-btn-label">删除</span>
      </motion.button>
    </div>
  </motion.div>
</template>

<script setup>
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

defineProps({
  busy: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['sediment', 'delete', 'clear'])

const { presets } = useMotionPresets()
</script>

<style scoped>
.note-bulk-bar {
  display: inline-flex;
  align-items: stretch;
  gap: 8px;
  width: fit-content;
  max-width: calc(100vw - 48px);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
  box-sizing: border-box;
}

.note-bulk-actions {
  display: inline-flex;
  align-items: stretch;
  gap: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--color-border);
}

.note-bulk-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  min-height: 56px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.note-bulk-btn:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.08);
}

.note-bulk-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.note-bulk-btn--clear {
  color: var(--color-secondary-text);
}

.note-bulk-btn--clear:hover:not(:disabled) {
  color: var(--color-text);
  background: rgba(24, 24, 27, 0.08);
}

.note-bulk-btn--danger {
  color: var(--color-error);
}

.note-bulk-btn--danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.1);
}

.note-bulk-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.note-bulk-btn-label {
  line-height: 1.2;
  white-space: nowrap;
}
</style>
