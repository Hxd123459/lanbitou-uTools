<template>
  <section class="note-timeline" @scroll="onScroll">
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
    <div v-if="loading" class="loading-more">加载中...</div>
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

const emit = defineEmits(['copy', 'load-more'])

const onScroll = (event) => {
  const { scrollTop, scrollHeight, clientHeight } = event.target
  if (scrollHeight - (scrollTop + clientHeight) <= 48) {
    emit('load-more')
  }
}
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

.loading-more {
  padding: 14px 0 8px;
  color: var(--color-secondary-text);
  font-size: 12px;
  text-align: center;
}
</style>
