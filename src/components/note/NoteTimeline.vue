<template>
  <section class="note-timeline">
    <div v-for="group in groups" :key="group.dateKey" class="date-group">
      <div class="date-label">{{ group.label }}</div>
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
})

const emit = defineEmits(['copy'])
</script>

<style scoped>
.note-timeline {
  max-height: calc(100vh - 250px);
  overflow: auto;
  padding-right: 4px;
}

.date-group + .date-group {
  margin-top: 18px;
}

.date-label {
  margin-bottom: 10px;
  color: var(--color-secondary-text);
  font-size: 13px;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
