<template>
  <div v-if="items.length" class="attachment-strip">
    <motion.div
      v-for="item in items"
      :key="item.key"
      class="attachment-tile"
      :initial="presets.thumbPop.initial"
      :animate="presets.thumbPop.animate"
      :transition="presets.thumbPop.transition"
    >
      <img
        v-if="item.kind === 'image'"
        :src="item.previewUrl || item.url"
        alt="预览"
        draggable="false"
      />
      <div v-else class="attachment-tile-file">
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span class="attachment-tile-name" :title="item.name">
          {{ truncateFileName(item.name, 8) }}
        </span>
      </div>
      <motion.button
        type="button"
        class="attachment-remove"
        :disabled="disabled"
        :aria-label="item.kind === 'image' ? '移除图片' : '移除附件'"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="emit('remove', item.key)"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      </motion.button>
    </motion.div>
  </div>
</template>

<script setup>
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { truncateFileName } from '../../utils/attachmentDisplay'

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['remove'])

const { presets } = useMotionPresets()
</script>

<style scoped>
.attachment-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.attachment-tile {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: visible;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.attachment-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 5px;
  display: block;
}

.attachment-tile-file {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  box-sizing: border-box;
  color: var(--color-accent);
}

.attachment-tile-name {
  max-width: 100%;
  font-size: 9px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  color: var(--color-secondary-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-remove {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.85);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

.attachment-remove:hover:not(:disabled) {
  background: #18181b;
}

.attachment-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
