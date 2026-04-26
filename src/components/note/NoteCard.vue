<template>
  <article class="note-card" @click="emit('copy', note.text)">
    <p class="note-text">{{ note.text }}</p>
  </article>
</template>

<script setup>
defineProps({
  note: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['copy'])
</script>

<style scoped>
.note-card {
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.note-card:hover {
  border-color: #d4d4d8;
  box-shadow: 0 4px 14px rgba(24, 24, 27, 0.08);
}

.note-text {
  margin: 0;
  color: var(--color-text);
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
