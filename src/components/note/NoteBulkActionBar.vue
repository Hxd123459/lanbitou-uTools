<template>
  <motion.div
    class="note-bulk-bar"
    role="toolbar"
    aria-label="已选笔记操作"
    :initial="presets.reveal.initial"
    :animate="presets.reveal.animate"
    :transition="presets.reveal.transition"
  >
    <span class="note-bulk-count">已选 {{ count }} 条</span>
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
        <span>去沉淀</span>
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
        <span>删除</span>
      </motion.button>
    </div>
  </motion.div>
</template>

<script setup>
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

defineProps({
  count: {
    type: Number,
    default: 0,
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['sediment', 'delete'])

const { presets } = useMotionPresets()
</script>

<style scoped>
.note-bulk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: var(--frame-inner-width);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
  box-sizing: border-box;
}

.note-bulk-count {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.note-bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.note-bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 12px;
  border: 0;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
}

.note-bulk-btn:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.1);
}

.note-bulk-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.note-bulk-btn--danger {
  color: var(--color-error);
  background: rgba(220, 38, 38, 0.08);
}

.note-bulk-btn--danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.14);
}

.note-bulk-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
