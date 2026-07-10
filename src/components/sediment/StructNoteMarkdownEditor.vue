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

  <CopyToast
    :visible="showToast"
    :text="toastText"
    :type="toastType"
    :z-index="250"
    @close="closeToast"
  />
  <input
    ref="attachmentInputRef"
    type="file"
    multiple
    class="struct-note-attachment-input"
    @change="onAttachmentPicked"
  />
</template>

<script setup>
import NodeRange from '@tiptap/extension-node-range'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  persistAttachmentRefsInMarkdown,
  resolveAttachmentRefsInMarkdown,
} from '../../utils/attachmentMarkdown'
import {
  normalizeMarkdownForCompare,
  setEditorMarkdownContent,
} from '../../utils/fragmentIntroMarkers'
import { createTiptapExtensions } from '../../composables/useTiptapExtensions'
import { createImageCopyExtension } from '../../extensions/tiptapImageCopy'
import { createAttachmentPasteExtension } from '../../extensions/tiptapAttachmentPaste'
import { prepareAttachmentForInsert } from '../../utils/tiptapAttachmentInsert'
import { useCopyNote } from '../../composables/useCopyNote'
import CopyToast from '../feedback/CopyToast.vue'
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
  'file-too-large',
  'update:selectedInsertPreset',
  'cancel-fragment-intro',
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
const attachmentInputRef = ref(null)
let dragHandleApi = null

const {
  showToast,
  toastText,
  toastType,
  closeToast,
  openToast,
} = useCopyNote()

const getImagePasteContext = () => ({
  noteId: props.noteId,
  onImageTooLarge: () => emit('image-too-large'),
  onFileTooLarge: () => emit('file-too-large'),
})

const getImageCopyContext = () => ({
  onCopied: () => {
    openToast('已复制图片', 'success', { duration: 1600 })
  },
  onCopyFailed: () => {
    openToast('复制失败', 'error', { duration: 1600 })
  },
})

let lastEmittedMarkdown = ''

const scrollSelectionIntoView = (currentEditor) => {
  const column = currentEditor.view.dom.closest('.struct-note-editor-column')
  if (!column) return
  const { from } = currentEditor.state.selection
  const coords = currentEditor.view.coordsAtPos(from)
  const columnRect = column.getBoundingClientRect()
  const margin = 48
  if (coords.bottom > columnRect.bottom - margin) {
    column.scrollTop += coords.bottom - columnRect.bottom + margin
  } else if (coords.top < columnRect.top + margin) {
    column.scrollTop -= columnRect.top + margin - coords.top
  }
}

const editor = useEditor({
  content: '',
  editable: !props.disabled,
  immediatelyRender: false,
  extensions: [
    ...createTiptapExtensions({
      enableImage: true,
      enableFragmentIntro: true,
      fragmentIntroOptions: {
        onCancelFragmentIntro: (fragmentIds) => {
          emit('cancel-fragment-intro', fragmentIds)
        },
      },
    }),
    NodeRange,
    createAttachmentPasteExtension(getImagePasteContext),
    createImageCopyExtension(getImageCopyContext),
  ],
  editorProps: {
    attributes: {
      class: 'struct-note-md-prosemirror',
    },
  },
  onCreate: ({ editor: currentEditor }) => {
    currentEditor.storage.attachment = {
      pick: () => attachmentInputRef.value?.click(),
    }
    setEditorMarkdownContent(currentEditor, props.modelValue, { emitUpdate: false })
    lastEmittedMarkdown = normalizeMarkdownForCompare(props.modelValue)
  },
  onUpdate: ({ editor: currentEditor }) => {
    const markdown = persistAttachmentRefsInMarkdown(currentEditor.getMarkdown())
    lastEmittedMarkdown = normalizeMarkdownForCompare(markdown)
    emit('update:modelValue', markdown)
  },
  onSelectionUpdate: ({ editor: currentEditor }) => {
    scrollSelectionIntoView(currentEditor)
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
    const normalized = normalizeMarkdownForCompare(value)
    if (normalized === lastEmittedMarkdown) return
    const currentNormalized = normalizeMarkdownForCompare(editor.value.getMarkdown())
    if (normalized === currentNormalized) {
      lastEmittedMarkdown = normalized
      return
    }
    setEditorMarkdownContent(editor.value, value || '', {
      emitUpdate: false,
      preserveSelection: true,
    })
    lastEmittedMarkdown = normalized
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

const setMarkdownContent = (value, { emitUpdate = true, preserveSelection = true } = {}) => {
  const applied = setEditorMarkdownContent(editor.value, value, { emitUpdate, preserveSelection })
  if (applied) {
    lastEmittedMarkdown = normalizeMarkdownForCompare(value)
  }
  return applied
}

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

const insertAttachmentResult = async (result) => {
  const currentEditor = editor.value
  if (!currentEditor || currentEditor.isDestroyed || result.error) return false
  if (result.kind === 'image' && result.src) {
    currentEditor.chain().focus().setImage({ src: result.src, alt: result.alt }).run()
    return true
  }
  if (result.kind === 'file' && result.href) {
    currentEditor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: result.label,
        marks: [
          {
            type: 'link',
            attrs: {
              href: result.href,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          },
        ],
      })
      .insertContent(' ')
      .run()
    return true
  }
  return false
}

const onAttachmentPicked = async (event) => {
  const files = Array.from(event.target.files || []).filter(Boolean)
  event.target.value = ''
  if (!files.length || !editor.value) return
  for (const file of files) {
    const result = await prepareAttachmentForInsert(file, props.noteId)
    if (result.error === 'image-too-large') {
      emit('image-too-large')
      continue
    }
    if (result.error === 'file-too-large') {
      emit('file-too-large')
      continue
    }
    await insertAttachmentResult(result)
  }
}

const setStreamingMarkdown = (value, { emitUpdate = false } = {}) => {
  setMarkdownContent(value, { emitUpdate, preserveSelection: 'end' })
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
  padding-inline: 10px;
  box-sizing: border-box;
}

.struct-note-md-editor.is-disabled :deep(.struct-note-md-prosemirror) {
  opacity: 0.72;
}

.struct-note-attachment-input {
  display: none;
}

.struct-note-md-editor :deep(a[href^='blob:']),
.struct-note-md-editor :deep(a[href^='lb-att://']) {
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

.struct-note-md-editor :deep(a[href^='blob:']:hover),
.struct-note-md-editor :deep(a[href^='lb-att://']:hover) {
  background: rgba(37, 99, 235, 0.1);
}
</style>
