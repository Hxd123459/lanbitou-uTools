<template>
  <span
    ref="triggerRef"
    class="app-tooltip-trigger"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
  </span>

  <Teleport to="body">
    <div
      v-if="visible && text"
      class="app-tooltip"
      role="tooltip"
      :style="tooltipStyle"
    >
      {{ text }}
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  /** 气泡相对触发点的间距（px） */
  offset: { type: Number, default: 8 },
  /** below | above */
  placement: { type: String, default: 'below' },
})

const triggerRef = ref(null)
const visible = ref(false)
const pos = ref({ top: 0, left: 0 })

const tooltipStyle = computed(() => ({
  top: `${pos.value.top}px`,
  left: `${pos.value.left}px`,
}))

const updatePosition = () => {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const left = rect.left + rect.width / 2
  const top =
    props.placement === 'above'
      ? rect.top - props.offset
      : rect.bottom + props.offset
  pos.value = { top, left }
}

const show = async () => {
  if (!String(props.text || '').trim()) return
  visible.value = true
  await nextTick()
  updatePosition()
}

const hide = () => {
  visible.value = false
}

const onScrollOrResize = () => {
  if (!visible.value) return
  updatePosition()
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
}

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})
</script>

<style scoped>
.app-tooltip-trigger {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
</style>

<style>
.app-tooltip {
  position: fixed;
  z-index: 320;
  max-width: min(360px, 80vw);
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transform: translate(-50%, 0);
}
</style>
