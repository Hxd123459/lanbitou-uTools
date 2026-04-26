<template>
  <section class="qa-list">
    <QAItem v-for="item in items" :key="item.id" :item="item" />
  </section>
</template>

<script setup>
import QAItem from './QAItem.vue'

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})
</script>

<style scoped>
.qa-list {
  max-height: calc(100vh - 250px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}
</style>
