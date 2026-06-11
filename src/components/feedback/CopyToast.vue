<template>
  <AnimatePresence>
    <motion.div
      v-if="visible"
      key="copy-toast"
      class="copy-toast"
      :class="type"
      :initial="presets.toast.initial"
      :animate="presets.toast.animate"
      :exit="presets.toast.exit"
      :transition="presets.toast.transition"
    >
      <span class="toast-text">{{ text }}</span>
      <motion.button
        v-if="actionLabel"
        type="button"
        class="toast-action"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="onActionClick"
      >
        {{ actionLabel }}
      </motion.button>
      <motion.button
        v-if="dismissMode === 'manual'"
        type="button"
        class="toast-close"
        aria-label="关闭提醒"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="onCloseClick"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      </motion.button>
    </motion.div>
  </AnimatePresence>
</template>

<script setup>
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    default: '复制成功',
  },
  type: {
    type: String,
    default: 'success',
  },
  actionLabel: {
    type: String,
    default: '',
  },
  dismissMode: {
    type: String,
    default: 'auto',
  },
})

const emit = defineEmits(['action', 'close'])
const { presets } = useMotionPresets()

const onActionClick = () => {
  emit('action')
}

const onCloseClick = () => {
  emit('close')
}
</script>

<style scoped>
.copy-toast {
  position: fixed;
  left: 24px;
  bottom: 24px;
  z-index: 120;
  height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px 0 16px;
  border-radius: 10px;
  color: #fff;
  background: rgba(24, 24, 27, 0.92);
  backdrop-filter: saturate(160%) blur(8px);
  -webkit-backdrop-filter: saturate(160%) blur(8px);
  font-size: 13px;
  box-shadow: 0 10px 30px rgba(24, 24, 27, 0.18);
}

.copy-toast.success {
  background: rgba(24, 24, 27, 0.92);
}

.copy-toast.error {
  background: var(--color-error);
}

.toast-text {
  white-space: nowrap;
  letter-spacing: 0.2px;
}

.toast-action {
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.toast-action:hover {
  background: rgba(255, 255, 255, 0.28);
}

.toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
}

.toast-close:hover {
  background: rgba(255, 255, 255, 0.22);
}
</style>
