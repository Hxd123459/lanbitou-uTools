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
