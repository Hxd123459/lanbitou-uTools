<template>
  <StructNoteEditorLayout
    v-if="withFragments"
    class="struct-note-md-editor-layout"
    v-model:fragment-notes="fragmentNotesModel"
    v-model:open="fragmentsOpenModel"
    v-model:panel-tab="fragmentsPanelTab"
    :inserted-ids="insertedIds"
    :inserted-id-list="insertedIdList"
    :restored-fragment-hint="restoredFragmentHint"
    :disabled="disabled"
    :show-expand-button="showExpandButton"
    :fragments-mode="fragmentsMode"
    :restoring-id="restoringId"
    :all-fragments-inserted="allFragmentsInserted"
    :enable-fragment-picker="enableFragmentPicker"
    :restorable-ids="restorableIds"
    :selected-insert-preset="selectedInsertPreset"
    :introduced-fragment-methods="introducedFragmentMethods"
    :ai-processing="aiProcessing"
    :processing-fragment-id="processingFragmentId"
    @insert="emit('insert', $event)"
    @insert-all="emit('insert-all')"
    @restore="emit('restore', $event)"
    @update:selected-insert-preset="emit('update:selectedInsertPreset', $event)"
  >
    <slot name="prefix" />
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
import {
  persistAttachmentRefsInMarkdown,
  resolveAttachmentRefsInMarkdown,
} from '../../utils/attachmentMarkdown'
import { setEditorMarkdownContent } from '../../utils/fragmentIntroMarkers'
import { createTiptapExtensions } from '../../composables/useTiptapExtensions'
import { createImagePasteExtension } from '../../extensions/tiptapImagePaste'
import {
  mountStructNoteDragHandle,
  unmountStructNoteDragHandle,
} from '../../composables/useStructNoteDragHandle'
import '../../assets/styles/tiptap-slash-menu.css'
import '../../assets/styles/struct-note-drag-handle.css'
import '../../assets/styles/fragment-intro-block.css'
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
  insertedIdList: {
    type: Array,
    default: () => [],
  },
  restoredFragmentHint: {
    type: Object,
    default: null,
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
  allFragmentsInserted: {
    type: Boolean,
    default: false,
  },
  noteId: {
    type: String,
    default: '',
  },
  enableFragmentPicker: {
    type: Boolean,
    default: false,
  },
  restorableIds: {
    type: Array,
    default: () => [],
  },
  selectedInsertPreset: {
    type: String,
    default: null,
  },
  introducedFragmentMethods: {
    type: Object,
    default: () => ({}),
  },
  aiProcessing: {
    type: Boolean,
    default: false,
  },
  processingFragmentId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'update:modelValue',
  'update:fragmentNotes',
  'update:fragmentsOpen',
  'insert',
  'insert-all',
  'restore',
  'image-too-large',
  'update:selectedInsertPreset',
])

const fragmentNotesModel = computed({
  get: () => props.fragmentNotes,
  set: (value) => emit('update:fragmentNotes', value),
})

const fragmentsOpenModel = computed({
  get: () => props.fragmentsOpen,
  set: (value) => emit('update:fragmentsOpen', value),
})

const fragmentsPanelTab = ref('selected')

const rootStyle = computed(() => ({
  '--struct-note-md-min-height': `${Number(props.minHeight) || 320}px`,
}))

const dragHandleRef = ref(null)
let dragHandleApi = null

const getImagePasteContext = () => ({
  noteId: props.noteId,
  onImageTooLarge: () => emit('image-too-large'),
})

const editor = useEditor({
  content: '',
  editable: !props.disabled,
  immediatelyRender: false,
  extensions: [
    ...createTiptapExtensions({ enableImage: true, enableFragmentIntro: true }),
    NodeRange,
    createImagePasteExtension(getImagePasteContext),
  ],
  editorProps: {
    attributes: {
      class: 'struct-note-md-prosemirror',
    },
  },
  onCreate: ({ editor: currentEditor }) => {
    setEditorMarkdownContent(currentEditor, props.modelValue, { emitUpdate: false })
  },
  onUpdate: ({ editor: currentEditor }) => {
    emit('update:modelValue', persistAttachmentRefsInMarkdown(currentEditor.getMarkdown()))
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
    const resolved = resolveAttachmentRefsInMarkdown(value || '')
    const currentResolved = resolveAttachmentRefsInMarkdown(current || '')
    if (resolved === currentResolved) return
    setEditorMarkdownContent(editor.value, value || '', { emitUpdate: false })
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

const setMarkdownContent = (value, { emitUpdate = true } = {}) =>
  setEditorMarkdownContent(editor.value, value, { emitUpdate })

const appendMarkdownChunk = (chunk) => {
  if (!editor.value || editor.value.isDestroyed) return
  const addition = resolveAttachmentRefsInMarkdown(String(chunk ?? ''))
  if (!addition) return
  try {
    editor.value.commands.insertContent(addition, { contentType: 'markdown' })
  } catch (error) {
    console.warn('[烂笔头] markdown 流式插入失败', error)
  }
}

const setStreamingMarkdown = (value, { emitUpdate = false } = {}) => {
  setMarkdownContent(value, { emitUpdate })
}

defineExpose({ focus, setMarkdownContent, appendMarkdownChunk, setStreamingMarkdown })

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
