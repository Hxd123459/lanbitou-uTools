<template>
  <div v-if="hasContent" class="tiptap-preview tiptap-content">
    <EditorContent :editor="editor" />
  </div>
  <p v-else-if="showFallback" class="tiptap-preview-fallback">
    {{ fallbackText }}
  </p>
</template>

<script setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, nextTick, onBeforeUnmount, watch } from 'vue'
import { createTiptapExtensions } from '../../composables/useTiptapExtensions'

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

const emit = defineEmits(['updated'])

const notifyUpdated = () => {
  nextTick(() => emit('updated'))
}

const hasContent = computed(() => Boolean((props.content || '').trim()))

const editor = useEditor({
  content: props.content || '',
  contentType: 'markdown',
  editable: false,
  immediatelyRender: false,
  extensions: createTiptapExtensions({
    placeholder: '',
    slashCommand: false,
    markdownPaste: false,
    enableImage: true,
  }),
  onCreate: () => {
    notifyUpdated()
  },
})

watch(
  () => props.content,
  (value) => {
    if (!editor.value) return
    const current = editor.value.getMarkdown()
    if ((value || '') === (current || '')) return
    editor.value.commands.setContent(value || '', {
      contentType: 'markdown',
      emitUpdate: false,
    })
    notifyUpdated()
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
.tiptap-preview-fallback {
  margin: 0;
  color: var(--color-secondary-text);
  font-size: 13px;
}

.tiptap-preview :deep(a[href^='blob:']),
.tiptap-preview :deep(a[href^='lb-att://']) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: rgba(37, 99, 235, 0.05);
  color: var(--color-accent);
  text-decoration: none;
  font-size: 13px;
  line-height: 1.5;
}
</style>
