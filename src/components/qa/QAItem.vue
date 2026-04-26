<template>
  <article class="qa-item">
    <section class="bubble question">
      <div class="label">问</div>
      <p>{{ item.question }}</p>
    </section>
    <section class="bubble answer">
      <div class="label">答</div>
      <p>{{ item.answer || '思考中...' }}</p>
      <span v-if="item.isStreaming" class="streaming-dot"></span>
    </section>
  </article>
</template>

<script setup>
defineProps({
  item: {
    type: Object,
    required: true,
  },
})
</script>

<style scoped>
.qa-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bubble {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: 12px 14px;
}

.label {
  margin-bottom: 6px;
  color: var(--color-secondary-text);
  font-size: 12px;
}

.bubble p {
  margin: 0;
  color: var(--color-text);
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.answer {
  border-color: #dbeafe;
  background: #f8fbff;
}

.streaming-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-top: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}
</style>
