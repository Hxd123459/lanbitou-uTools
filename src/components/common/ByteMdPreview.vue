<template>
  <div v-if="hasContent" class="byte-md-preview">
    <Viewer :value="content" :plugins="viewerPlugins" />
  </div>
  <p v-else-if="showFallback" class="byte-md-preview-fallback">
    {{ fallbackText }}
  </p>
</template>

<script setup>
import { computed } from 'vue'
import { Viewer } from '@bytemd/vue-next'
import { getByteMdViewerPlugins } from '../../composables/useByteMdPlugins'

const props = defineProps({
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
})

const viewerPlugins = getByteMdViewerPlugins()
const hasContent = computed(() => Boolean((props.content || '').trim()))
</script>
