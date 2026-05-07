<template>
  <section class="note-timeline">
    <div v-if="!groups.length && !loading" class="empty-state">
      <p>还没有笔记，先记录一条吧。</p>
    </div>

    <div v-for="group in groups" :key="group.dateKey" class="date-group">
      <div class="date-label">
        <span class="date-text">{{ group.label }}</span>
        <span class="date-line" />
      </div>
      <div class="card-list">
        <NoteCard
          v-for="item in group.items"
          :key="item.id"
          :note="item"
          @copy="emit('copy', $event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import NoteCard from './NoteCard.vue'

defineProps({
  groups: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['copy'])
</script>

<style scoped>
.note-timeline {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-state {
  padding: 48px 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
}

.date-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.date-label {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-secondary-text);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.date-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
