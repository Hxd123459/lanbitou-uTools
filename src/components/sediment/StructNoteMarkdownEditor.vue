<template>
  <StructNoteEditorLayout
    v-if="withFragments"
    class="struct-note-md-editor-layout"
    v-model:fragment-notes="fragmentNotesModel"
    v-model:open="fragmentsOpenModel"
    :inserted-ids="insertedIds"
    :disabled="disabled"
    :show-expand-button="showExpandButton"
    :fragments-mode="fragmentsMode"
    :restoring-id="restoringId"
    :active-fragment-id="activeFragmentId"
    @insert="emit('insert', $event)"
    @restore="emit('restore', $event)"
  >
    <slot name="prefix" />
    <StructNoteMaterialBar
      :fragment-notes="fragmentNotesModel"
      :inserted-ids="insertedIds"
      :disabled="disabled"
      :mode="fragmentsMode"
      :panel-open="fragmentsOpenModel"
      :active-fragment-id="activeFragmentId"
      @update:fragment-notes="fragmentNotesModel = $event"
      @toggle-fragment="onToggleFragment"
    />
    <div class="struct-note-material-divider" aria-hidden="true" />
    <div
      class="struct-note-md-editor"
      :class="{ 'is-disabled': disabled }"
      :style="rootStyle"
    >
      <div
        ref="dragHandleRef"
        class="struct-note-drag-handle"
        data-dragging="false"
        aria-hidden="true"
      >
        <span class="struct-note-drag-handle-grip">⋮⋮</span>
      </div>
      <EditorContent :editor="editor" class="struct-note-md-editor__content tiptap-content" />
    </div>
  </StructNoteEditorLayout>

  <div
    v-else
    class="struct-note-md-editor"
    :class="{ 'is-disabled': disabled }"
    :style="rootStyle"
  >
    <div
      ref="dragHandleRef"
      class="struct-note-drag-handle"
      data-dragging="false"
      aria-hidden="true"
    >
      <span class="struct-note-drag-handle-grip">⋮⋮</span>
    </div>
    <EditorContent :editor="editor" class="struct-note-md-editor__content tiptap-content" />
  </div>
</template>

<script setup>
import NodeRange from '@tiptap/extension-node-range'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createTiptapExtensions } from '../../composables/useTiptapExtensions'
import {
  mountStructNoteDragHandle,
  unmountStructNoteDragHandle,
} from '../../composables/useStructNoteDragHandle'
import '../../assets/styles/tiptap-slash-menu.css'
import '../../assets/styles/struct-note-drag-handle.css'
import StructNoteEditorLayout from './StructNoteEditorLayout.vue'
import StructNoteMaterialBar from './StructNoteMaterialBar.vue'

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
    default: false,
  },
  showExpandButton: {
    type: Boolean,
    default: true,
  },
  fragmentsMode: {
    type: String,
    default: 'compose',
  },
  restoringId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'update:modelValue',
  'update:fragmentNotes',
  'update:fragmentsOpen',
  'insert',
  'restore',
])

const fragmentNotesModel = computed({
  get: () => props.fragmentNotes,
  set: (value) => emit('update:fragmentNotes', value),
})

const fragmentsOpenModel = computed({
  get: () => props.fragmentsOpen,
  set: (value) => emit('update:fragmentsOpen', value),
})

const activeFragmentId = ref(null)

watch(fragmentsOpenModel, (open) => {
  if (!open) activeFragmentId.value = null
})

const onToggleFragment = (note) => {
  const id = note?.id ? String(note.id) : ''
  if (!id) return
  if (fragmentsOpenModel.value && activeFragmentId.value === id) {
    fragmentsOpenModel.value = false
    activeFragmentId.value = null
    return
  }
  activeFragmentId.value = id
  fragmentsOpenModel.value = true
}

const rootStyle = computed(() => ({
  '--struct-note-md-min-height': `${Number(props.minHeight) || 320}px`,
}))

const dragHandleRef = ref(null)
let dragHandleApi = null

const editor = useEditor({
  content: props.modelValue || '',
  contentType: 'markdown',
  editable: !props.disabled,
  immediatelyRender: false,
  extensions: [...createTiptapExtensions(), NodeRange],
  editorProps: {
    attributes: {
      class: 'struct-note-md-prosemirror',
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    emit('update:modelValue', currentEditor.getMarkdown())
  },
})

const syncDragHandle = async () => {
  const currentEditor = editor.value
  const handleEl = dragHandleRef.value

  if (dragHandleApi) {
    unmountStructNoteDragHandle(currentEditor, dragHandleApi)
    dragHandleApi = null
  }

  if (!currentEditor || currentEditor.isDestroyed || !handleEl) return

  dragHandleApi = mountStructNoteDragHandle(currentEditor, handleEl)
}

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

watch(
  () => [editor.value, dragHandleRef.value],
  async () => {
    await nextTick()
    await syncDragHandle()
  },
  { flush: 'post' },
)

const focus = () => {
  editor.value?.commands.focus('end')
}

defineExpose({ focus })

onBeforeUnmount(() => {
  unmountStructNoteDragHandle(editor.value, dragHandleApi)
  dragHandleApi = null
  editor.value?.destroy()
})
</script>

<style scoped>
.struct-note-md-editor-layout {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.struct-note-material-divider {
  height: 1px;
  background: rgba(24, 24, 27, 0.07);
  margin-bottom: 12px;
  flex: 0 0 auto;
}

.struct-note-md-editor {
  position: relative;
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
