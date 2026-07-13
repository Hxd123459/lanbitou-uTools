<template>
  <div
    class="lanbitou-mascot"
    :class="{
      'is-dragging': dragging,
      'is-custom-position': hasCustomPosition,
    }"
    :style="rootStyle"
    aria-live="polite"
  >
    <div
      class="lanbitou-mascot-body"
      :class="{ 'is-peek': !isActive && !dragging }"
      aria-hidden="true"
      @pointerdown="onPointerDown"
    >
      <img
        class="lanbitou-mascot-img"
        src="/mascot.png"
        alt=""
        draggable="false"
      />
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="isActive && message"
      class="lanbitou-mascot-bubble-host"
      :class="[bubbleClass, { 'is-visible': isActive }]"
      :style="bubbleStyle"
    >
      <p class="lanbitou-mascot-bubble-text">{{ message }}</p>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useLanbitouMascotBubble } from '../../composables/useLanbitouMascotBubble'
import { useLanbitouMascotDrag } from '../../composables/useLanbitouMascotDrag'
import { MascotPhase } from '../../mascot/lanbitouMascotApi'

const props = defineProps({
  phase: {
    type: String,
    default: MascotPhase.PEEK,
  },
  message: {
    type: String,
    default: '',
  },
})

const {
  position,
  dragging,
  hasCustomPosition,
  rootStyle,
  onPointerDown,
} = useLanbitouMascotDrag()

const isActive = computed(
  () => props.phase === MascotPhase.SPEAKING && Boolean(props.message),
)

const { bubbleStyle, bubbleClass } = useLanbitouMascotBubble({
  visible: () => isActive.value,
  message: () => props.message,
  position: () => position.value,
  dragging: () => dragging.value,
  peek: () => !isActive.value && !dragging.value,
})
</script>

<style scoped>
.lanbitou-mascot {
  position: fixed;
  right: 18px;
  bottom: 0;
  z-index: 240;
  width: 52px;
  height: 96px;
  pointer-events: none;
  touch-action: none;
}

.lanbitou-mascot-body {
  width: 100%;
  height: 100%;
  background: transparent;
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
  transform: translateY(0) rotate(0deg);
  transform-origin: 85% 100%;
  transition: transform 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.lanbitou-mascot-body.is-peek {
  transform: translateY(42%) rotate(-14deg);
}

.lanbitou-mascot.is-dragging .lanbitou-mascot-body {
  transition: none;
  transform: translateY(0) rotate(-4deg);
}

.lanbitou-mascot-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px rgba(24, 24, 27, 0.12));
  pointer-events: none;
}

@media (max-width: 720px) {
  .lanbitou-mascot:not(.is-custom-position) {
    right: 10px;
  }
}
</style>

<style>
.lanbitou-mascot-bubble-host {
  position: fixed;
  z-index: 241;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(24, 24, 27, 0.92);
  color: #fff;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  opacity: 0;
  transform: translateY(8px) scale(0.96);
  transition:
    opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.lanbitou-mascot-bubble-host.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.lanbitou-mascot-bubble-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}

.lanbitou-mascot-bubble-host.is-placement-above-right,
.lanbitou-mascot-bubble-host.is-placement-above-left {
  border-bottom-right-radius: 4px;
}

.lanbitou-mascot-bubble-host.is-placement-below-right,
.lanbitou-mascot-bubble-host.is-placement-below-left {
  border-top-right-radius: 4px;
}
</style>
