<template>
  <div class="gallery">
    <button
      v-for="(img, idx) in images"
      :key="img.id ?? idx"
      type="button"
      class="tile"
      :aria-label="`查看图片 ${idx + 1}`"
      @click="open(idx)"
    >
      <img
        :src="img.url"
        :alt="`图片 ${idx + 1}`"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <span class="tile-overlay" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      </span>
    </button>
  </div>

  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="active !== -1"
        key="lightbox"
        class="lightbox"
        role="dialog"
        aria-modal="true"
        :initial="presets.fade.initial"
        :animate="presets.fade.animate"
        :exit="presets.fade.exit"
        :transition="presets.fade.transition"
        @click.self="close"
      >
        <motion.button
          class="lb-btn lb-close"
          type="button"
          aria-label="关闭"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="close"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </motion.button>

        <motion.button
          v-if="images.length > 1"
          class="lb-btn lb-prev"
          type="button"
          aria-label="上一张"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="prev"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </motion.button>

        <div v-if="current" class="lb-stage">
          <motion.img
            :key="current.id ?? active"
            :src="current.url"
            :alt="`图片 ${active + 1}`"
            class="lb-img"
            draggable="false"
            :initial="presets.thumbPop.initial"
            :animate="presets.thumbPop.animate"
            :transition="presets.thumbPop.transition"
            @click.stop
          />

          <AnimatePresence>
            <motion.div
              v-if="copyFeedback"
              key="copy-feedback"
              class="lb-copy-feedback"
              :class="copyFeedback === 'error' ? 'is-error' : 'is-success'"
              :initial="{ opacity: 0, scale: 0.92, x: '-50%', y: '-50%' }"
              :animate="{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }"
              :exit="{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }"
              :transition="{ duration: 0.18, ease: 'easeOut' }"
            >
              {{ copyFeedback === 'error' ? '复制失败' : '已复制' }}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.button
          v-if="images.length > 1"
          class="lb-btn lb-next"
          type="button"
          aria-label="下一张"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="next"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </motion.button>

        <div v-if="images.length > 1" class="lb-counter">
          {{ active + 1 }} / {{ images.length }}
        </div>

        <div
          v-if="current && !copyFeedback"
          class="lb-hint"
          :class="{ 'has-counter': images.length > 1 }"
        >
          {{ copyHint }}
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  images: {
    type: Array,
    default: () => [],
  },
})

const { presets } = useMotionPresets()

const isMac = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/i.test(
    navigator.userAgentData?.platform || navigator.platform || '',
  )

const copyHint = computed(() =>
  `${isMac ? '⌘' : 'Ctrl'}+C 复制`,
)

const active = ref(-1)
const copyFeedback = ref('')
let copyFeedbackTimer = null

const current = computed(() =>
  active.value >= 0 ? props.images[active.value] : null,
)

const open = (index) => {
  active.value = index
}

const close = () => {
  active.value = -1
  clearCopyFeedback()
}

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

const prev = () => {
  if (!props.images.length) return
  active.value =
    active.value <= 0 ? props.images.length - 1 : active.value - 1
}

const next = () => {
  if (!props.images.length) return
  active.value = (active.value + 1) % props.images.length
}

const copyCurrentImage = async () => {
  const url = current.value?.url
  if (!url) return false
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const type = blob.type || 'image/png'
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
    } else {
      throw new Error('clipboard unsupported')
    }
    showCopyFeedback('success')
    return true
  } catch (error) {
    console.error('[NoteImageGallery] copy failed:', error)
    showCopyFeedback('error')
    return false
  }
}

const onKey = (event) => {
  if (active.value === -1) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prev()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    next()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    event.preventDefault()
    copyCurrentImage()
  }
}

let prevBodyOverflow = ''
watch(active, (val) => {
  if (val !== -1) {
    clearCopyFeedback()
    document.addEventListener('keydown', onKey)
    prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKey)
    document.body.style.overflow = prevBodyOverflow
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  clearCopyFeedback()
  if (active.value !== -1) {
    document.body.style.overflow = prevBodyOverflow
  }
})
</script>

<style scoped>
.gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  width: 100%;
}

.tile {
  position: relative;
  width: 96px;
  height: 96px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg);
  cursor: zoom-in;
  flex: 0 0 auto;
}

.tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tile:hover {
  border-color: rgba(24, 24, 27, 0.4);
  box-shadow: 0 4px 14px rgba(24, 24, 27, 0.08);
}

.tile:hover img {
  transform: scale(1.04);
}

.tile:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring);
}

.tile-overlay {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.6);
  color: #fff;
  opacity: 0;
  pointer-events: none;
}

.tile:hover .tile-overlay,
.tile:focus-visible .tile-overlay {
  opacity: 1;
}

/* === Lightbox === */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 15, 17, 0.86);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.lb-stage {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: min(90vw, 1400px);
  max-height: 86vh;
}

.lb-img {
  max-width: min(90vw, 1400px);
  max-height: 86vh;
  border-radius: 10px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: block;
  user-select: none;
}

.lb-copy-feedback {
  position: absolute;
  top: 50%;
  left: 50%;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: #fff;
  pointer-events: none;
  user-select: none;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}

.lb-copy-feedback.is-success {
  background: rgba(24, 24, 27, 0.72);
}

.lb-copy-feedback.is-error {
  background: rgba(185, 28, 28, 0.82);
}

.lb-btn {
  position: fixed;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.lb-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

.lb-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7);
}

.lb-close {
  top: 16px;
  right: 16px;
}

.lb-prev {
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
}

.lb-next {
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
}

.lb-counter {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.4px;
  font-variant-numeric: tabular-nums;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.lb-hint {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  letter-spacing: 0.2px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;
  user-select: none;
}

.lb-hint.has-counter {
  bottom: 48px;
}

@media (max-width: 480px) {
  .tile {
    width: 84px;
    height: 84px;
  }
  .lb-prev {
    left: 6px;
  }
  .lb-next {
    right: 6px;
  }
}
</style>
