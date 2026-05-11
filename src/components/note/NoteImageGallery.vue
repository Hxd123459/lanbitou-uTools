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
    <div
      v-if="active !== -1"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      @click.self="close"
    >
      <button
        class="lb-btn lb-close"
        type="button"
        aria-label="关闭"
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
      </button>

      <button
        v-if="images.length > 1"
        class="lb-btn lb-prev"
        type="button"
        aria-label="上一张"
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
      </button>

      <img
        v-if="current"
        :key="current.id ?? active"
        :src="current.url"
        :alt="`图片 ${active + 1}`"
        class="lb-img"
        draggable="false"
      />

      <button
        v-if="images.length > 1"
        class="lb-btn lb-next"
        type="button"
        aria-label="下一张"
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
      </button>

      <div v-if="images.length > 1" class="lb-counter">
        {{ active + 1 }} / {{ images.length }}
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  images: {
    type: Array,
    default: () => [],
  },
})

const active = ref(-1)

const current = computed(() =>
  active.value >= 0 ? props.images[active.value] : null,
)

const open = (index) => {
  active.value = index
}

const close = () => {
  active.value = -1
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
  }
}

let prevBodyOverflow = ''
watch(active, (val) => {
  if (val !== -1) {
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
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform var(--motion-fast);
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
  transition: opacity var(--motion-fast);
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
  animation: lb-fade var(--motion-fast) ease-out;
}

.lb-img {
  max-width: min(90vw, 1400px);
  max-height: 86vh;
  border-radius: 10px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: block;
  user-select: none;
  animation: lb-pop 220ms ease-out;
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
  transition: background var(--motion-fast), transform var(--motion-fast);
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

.lb-prev:hover {
  transform: translateY(-50%) translateX(-2px);
}

.lb-next {
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
}

.lb-next:hover {
  transform: translateY(-50%) translateX(2px);
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

@keyframes lb-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes lb-pop {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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

@media (prefers-reduced-motion: reduce) {
  .lightbox,
  .lb-img,
  .tile,
  .tile img,
  .lb-btn,
  .tile-overlay {
    animation: none;
    transition: none;
  }
}
</style>
