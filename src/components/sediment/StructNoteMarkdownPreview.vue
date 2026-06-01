<template>
  <div v-if="markdownNodes.length" class="struct-note-md-preview">
    <MarkdownRender
      :nodes="markdownNodes"
      :typewriter="false"
      :batch-rendering="false"
      :defer-nodes-until-visible="false"
      code-block-light-theme="github-light"
      code-block-dark-theme="github-light"
      :themes="codeThemes"
    />
  </div>
  <p v-else-if="showFallback" class="struct-note-md-preview-fallback">
    {{ fallbackText }}
  </p>
</template>

<script setup>
import { computed } from 'vue'
import {
  MarkdownRender,
  getMarkdown,
  parseMarkdownToStructure,
} from 'vue-renderer-markdown'

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
  parserKey: {
    type: String,
    default: 'struct-note-markdown',
  },
})

const codeThemes = { light: 'github-light', dark: 'github-light' }
const md = getMarkdown(props.parserKey)

const markdownNodes = computed(() => {
  const text = props.content || ''
  if (!text) return []
  try {
    return parseMarkdownToStructure(text, md)
  } catch (error) {
    console.error('[StructNoteMarkdownPreview] parse markdown failed:', error)
    return []
  }
})
</script>

<style scoped>
.struct-note-md-preview {
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text);
  word-break: break-word;
}

.struct-note-md-preview-fallback {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-secondary-text);
}
</style>
