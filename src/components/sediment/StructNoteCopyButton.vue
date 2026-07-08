<template>
  <div class="struct-note-copy-wrap">
    <motion.button
      type="button"
      class="btn btn-icon-text struct-note-copy-btn"
      title="复制正文（图文，可粘贴到其他平台）"
      :disabled="disabled || !canCopy"
      :while-hover="disabled || !canCopy ? undefined : presets.button.hover"
      :while-tap="disabled || !canCopy ? undefined : presets.button.tap"
      :transition="presets.button.transition"
      @click="handleCopy"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
        stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span>复制</span>
    </motion.button>

    <AnimatePresence>
      <motion.div
        v-if="copyFeedback"
        key="copy-feedback"
        class="struct-note-copy-feedback"
        :class="copyFeedback === 'error' ? 'is-error' : 'is-success'"
        :initial="{ opacity: 0, scale: 0.92 }"
        :animate="{ opacity: 1, scale: 1 }"
        :exit="{ opacity: 0, scale: 0.96 }"
        :transition="{ duration: 0.18, ease: 'easeOut' }"
      >
        {{ copyFeedback === 'error' ? '复制失败' : '已复制' }}
      </motion.div>
    </AnimatePresence>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { copyMarkdownWithImages } from '../../utils/copyNoteContent'

const props = defineProps({
  getContent: {
    type: Function,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['copied', 'copy-failed'])

const { presets } = useMotionPresets()
const copying = ref(false)
const copyFeedback = ref('')
let copyFeedbackTimer = null

const canCopy = computed(() => String(props.getContent?.() ?? '').trim().length > 0)

const clearCopyFeedback = () => {
  copyFeedback.value = ''
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = null
  }
}

const showCopyFeedback = (type) => {
  clearCopyFeedback()
  copyFeedback.value = type
  copyFeedbackTimer = setTimeout(() => {
    copyFeedback.value = ''
    copyFeedbackTimer = null
  }, 1400)
}

const handleCopy = async () => {
  if (!canCopy.value || copying.value || props.disabled) return
  copying.value = true
  try {
    await copyMarkdownWithImages(props.getContent())
    showCopyFeedback('success')
  } catch (error) {
    console.error('[StructNoteCopyButton] copy failed:', error)
    showCopyFeedback('error')
  } finally {
    copying.value = false
  }
}

onBeforeUnmount(() => {
  clearCopyFeedback()
})
</script>

<style scoped>
.struct-note-copy-wrap {
  position: relative;
  display: inline-flex;
}

.struct-note-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 14px;
  height: 36px;
}

.struct-note-copy-feedback {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--btn-radius, 8px);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #fff;
  pointer-events: none;
  user-select: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.struct-note-copy-feedback.is-success {
  background: rgba(24, 24, 27, 0.82);
}

.struct-note-copy-feedback.is-error {
  background: rgba(185, 28, 28, 0.88);
}
</style>
