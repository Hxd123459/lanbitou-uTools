<template>
  <article class="qa-item">
    <section class="bubble question">
      <div class="label">问</div>
      <p>{{ item.question }}</p>
    </section>
    <section class="bubble answer">
      <div class="label">答</div>
      <p>{{ item.answer }}</p>
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
</style>
