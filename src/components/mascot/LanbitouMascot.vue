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
    <div class="lanbitou-mascot-stack">
      <div
        ref="anchorRef"
        class="lanbitou-mascot-body"
        :class="{ 'is-peek': !dragging }"
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
  </div>

  <Teleport to="body">
    <Transition name="lanbitou-bubble">
      <div
        v-if="isActive && message && layoutReady"
        class="lanbitou-mascot-bubble-host"
        :style="bubbleHostStyle"
      >
        <MascotSpeechBubble ref="bubbleRef" :tail="bubbleTail">
          {{ message }}
        </MascotSpeechBubble>
      </div>
    </Transition>

    <!-- 离屏测量，用于计算定位 -->
    <div v-if="isActive && message && !layoutReady" class="lanbitou-mascot-bubble-measure" aria-hidden="true">
      <MascotSpeechBubble ref="bubbleRef" :tail="bubbleTail">
        {{ message }}
      </MascotSpeechBubble>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useLanbitouMascotBubble } from '../../composables/useLanbitouMascotBubble'
import { useLanbitouMascotDrag } from '../../composables/useLanbitouMascotDrag'
import { MascotPhase } from '../../mascot/lanbitouMascotApi'
import MascotSpeechBubble from './MascotSpeechBubble.vue'

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

const anchorRef = ref(null)
const bubbleRef = ref(null)

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

const {
  tail: bubbleTail,
  hostStyle: bubbleHostStyle,
  layoutReady,
} = useLanbitouMascotBubble({
  visible: () => isActive.value,
  message: () => props.message,
  position: () => position.value,
  dragging: () => dragging.value,
  anchorRef,
  bubbleRef,
})
</script>

<style scoped>
.lanbitou-mascot {
  position: fixed;
  right: 18px;
  bottom: 0;
  z-index: 240;
  pointer-events: none;
  touch-action: none;
  overflow: visible;
}

.lanbitou-mascot-stack {
  position: relative;
  width: 52px;
  height: 96px;
  overflow: visible;
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

  .lanbitou-mascot-stack {
    width: 44px;
    height: 82px;
  }
}
</style>

<style>
.lanbitou-mascot-bubble-host {
  z-index: 241;
  pointer-events: none;
}

.lanbitou-mascot-bubble-measure {
  position: fixed;
  left: -9999px;
  top: 0;
  visibility: hidden;
  pointer-events: none;
}

.lanbitou-bubble-enter-active,
.lanbitou-bubble-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.lanbitou-bubble-enter-from,
.lanbitou-bubble-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}
</style>
