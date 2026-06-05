<template>
  <StructNoteEditorLayout
    v-if="withFragments"
    class="struct-note-md-editor-layout"
    v-model:fragment-notes="fragmentNotesModel"
    v-model:open="fragmentsOpenModel"
    :inserted-ids="insertedIds"
    :disabled="disabled"
    :show-expand-button="showExpandButton"
    @insert="emit('insert', $event)"
  >
    <slot name="prefix" />
    <div
      class="struct-note-md-editor"
      :class="{ 'is-disabled': disabled }"
      :style="rootStyle"
    >
      <EditorContent :editor="editor" class="struct-note-md-editor__content tiptap-content" />
    </div>
  </StructNoteEditorLayout>

  <div
    v-else
    class="struct-note-md-editor"
    :class="{ 'is-disabled': disabled }"
    :style="rootStyle"
  >
    <EditorContent :editor="editor" class="struct-note-md-editor__content tiptap-content" />
  </div>
</template>

<script setup>
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, watch } from 'vue'
import { createTiptapExtensions } from '../../composables/useTiptapExtensions'
import '../../assets/styles/tiptap-slash-menu.css'
import '../../assets/styles/struct-note-drag-handle.css'
import StructNoteEditorLayout from './StructNoteEditorLayout.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  minHeight: {
    type: [Number, String],
    default: 320,
  },
  withFragments: {
    type: Boolean,
    default: false,
  },
  fragmentNotes: {
    type: Array,
    default: () => [],
  },
  insertedIds: {
    type: Object,
    default: () => new Set(),
  },
  fragmentsOpen: {
    type: Boolean,
    default: true,
  },
  showExpandButton: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits([
  'update:modelValue',
  'update:fragmentNotes',
  'update:fragmentsOpen',
  'insert',
])

const fragmentNotesModel = computed({
  get: () => props.fragmentNotes,
  set: (value) => emit('update:fragmentNotes', value),
})

const fragmentsOpenModel = computed({
  get: () => props.fragmentsOpen,
  set: (value) => emit('update:fragmentsOpen', value),
})

const rootStyle = computed(() => ({
  '--struct-note-md-min-height': `${Number(props.minHeight) || 320}px`,
}))

const editor = useEditor({
  content: props.modelValue || '',
  contentType: 'markdown',
  editable: !props.disabled,
  immediatelyRender: false,
  extensions: createTiptapExtensions({ dragHandle: true }),
  editorProps: {
    attributes: {
      class: 'struct-note-md-prosemirror',
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    emit('update:modelValue', currentEditor.getMarkdown())
  },
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return
    const current = editor.value.getMarkdown()
    if ((value || '') === (current || '')) return
    editor.value.commands.setContent(value || '', {
      contentType: 'markdown',
      emitUpdate: false,
    })
  },
)

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled)
  },
)

const focus = () => {
  editor.value?.commands.focus('end')
}

defineExpose({ focus })

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
.struct-note-md-editor-layout {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.struct-note-md-editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.struct-note-md-editor__content {
  flex: 1;
  min-height: var(--struct-note-md-min-height);
}

.struct-note-md-editor :deep(.struct-note-md-prosemirror) {
  min-height: var(--struct-note-md-min-height);
  outline: none;
}

.struct-note-md-editor.is-disabled :deep(.struct-note-md-prosemirror) {
  opacity: 0.72;
}
</style>
