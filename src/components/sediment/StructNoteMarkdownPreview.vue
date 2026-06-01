<template>
  <ByteMdPreview
    :content="content"
    :fallback-text="fallbackText"
    :show-fallback="showFallback"
  />
</template>

<script setup>
import ByteMdPreview from '../common/ByteMdPreview.vue'

defineProps({
  content: {
    type: String,
    default: '',
  },
  fallbackText: {
    type: String,
    default: '暂无内容',
  },
  showFallback: {
    type: Boolean,
    default: true,
  },
  parserKey: {
    type: String,
    default: 'struct-note-markdown',
  },
})
</script>
