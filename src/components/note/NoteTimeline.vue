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
</script>

<style scoped>
.note-timeline {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 10px 28px 0;
  display: flex;
  flex-direction: column;
  gap: 24px;

  scrollbar-width: thin;
  scrollbar-color: rgba(24, 24, 27, 0.18) transparent;
}

.note-timeline::-webkit-scrollbar {
  width: 8px;
}

.note-timeline::-webkit-scrollbar-track {
  background: transparent;
}

.note-timeline::-webkit-scrollbar-thumb {
  background: rgba(24, 24, 27, 0.18);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.note-timeline::-webkit-scrollbar-thumb:hover {
  background: rgba(24, 24, 27, 0.32);
  background-clip: content-box;
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
