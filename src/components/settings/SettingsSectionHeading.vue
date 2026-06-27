<template>
  <h3 class="settings-section-heading">
    {{ title }}
  </h3>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
})
</script>

<style scoped>
.settings-section-heading {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
  line-height: 1.3;
}
</style>
