<template>
  <div
    class="mascot-speech-bubble"
    :class="[`is-tail-${tail}`]"
    role="status"
  >
    <p class="mascot-speech-bubble-text">
      <slot />
    </p>
  </div>
</template>

<script setup>
defineProps({
  tail: {
    type: String,
    default: 'br',
    validator: (value) => ['bl', 'br', 'tl', 'tr'].includes(value),
  },
})
</script>

<style scoped>
.mascot-speech-bubble {
  position: relative;
  width: max-content;
  max-width: min(240px, calc(100vw - 72px));
  padding: 10px 13px;
  border-radius: 14px;
  background: #fff;
  color: #27272a;
  border: 1px solid rgba(24, 24, 27, 0.08);
  box-shadow:
    0 4px 16px rgba(24, 24, 27, 0.1),
    0 1px 3px rgba(24, 24, 27, 0.06);
  filter: drop-shadow(0 2px 6px rgba(24, 24, 27, 0.06));
}

.mascot-speech-bubble-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}

/* 经典 CSS 对话气泡尾巴（speech bubble tail） */
.mascot-speech-bubble::after {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border: 7px solid transparent;
}

.mascot-speech-bubble.is-tail-br::after {
  right: 16px;
  bottom: -13px;
  border-top-color: #fff;
  border-bottom: 0;
  filter: drop-shadow(0 2px 1px rgba(24, 24, 27, 0.05));
}

.mascot-speech-bubble.is-tail-bl::after {
  left: 16px;
  bottom: -13px;
  border-top-color: #fff;
  border-bottom: 0;
  filter: drop-shadow(0 2px 1px rgba(24, 24, 27, 0.05));
}

.mascot-speech-bubble.is-tail-tr::after {
  right: 16px;
  top: -13px;
  border-bottom-color: #fff;
  border-top: 0;
  filter: drop-shadow(0 -1px 1px rgba(24, 24, 27, 0.05));
}

.mascot-speech-bubble.is-tail-tl::after {
  left: 16px;
  top: -13px;
  border-bottom-color: #fff;
  border-top: 0;
  filter: drop-shadow(0 -1px 1px rgba(24, 24, 27, 0.05));
}
</style>
