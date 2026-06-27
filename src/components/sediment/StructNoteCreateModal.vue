<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="struct-note-modal"
        class="struct-note-modal"
        role="dialog"
        aria-modal="true"
        aria-label="新建文件"
        :initial="{ opacity: 0, y: 28 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: 28 }"
        :transition="{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }"
      >
        <header class="struct-note-modal-header">
          <motion.button
            type="button"
            class="struct-note-modal-close"
            aria-label="关闭"
            :while-hover="presets.button.hover"
            :while-tap="presets.button.tap"
            :transition="presets.button.transition"
            :disabled="saving"
            @click="emitClose"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </motion.button>

          <StructNoteFolderBreadcrumb
            ref="folderBreadcrumbRef"
            v-model:path-stack="pathStack"
            :disabled="saving || aiProcessing"
          />

          <div class="struct-note-modal-header-actions">
            <StructNoteCopyButton
              :get-content="() => draftContent"
              :disabled="saving || aiProcessing"
            />
            <motion.button
              type="button"
              class="btn btn-primary struct-note-modal-save"
              :disabled="saving || aiProcessing || !canSave"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="handleSave"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>{{ saving ? '保存中…' : '保存' }}</span>
            </motion.button>
          </div>
        </header>

        <StructNoteMarkdownEditor
          ref="contentEditorRef"
          v-model="draftContent"
          v-model:fragment-notes="localFragmentNotes"
          v-model:fragments-open="fragmentsOpen"
          class="struct-note-modal-editor"
          with-fragments
          :disabled="saving || aiProcessing"
          :inserted-ids="insertedFragmentIds"
          :introduced-fragment-methods="introducedFragmentMethods"
          :selected-insert-preset="selectedInsertPreset"
          :ai-processing="aiProcessing"
          :processing-fragment-id="processingFragmentId"
          :all-fragments-inserted="allFragmentsInserted"
          :min-height="240"
          @insert="insertFragment"
          @insert-all="insertAllFragments"
          @update:selected-insert-preset="selectedInsertPreset = $event"
          @image-too-large="emit('error', new Error('单张图片不能超过 10MB'))"
        >
          <template #prefix>
            <input
              ref="titleInputRef"
              v-model="draftTitle"
              class="struct-note-title-input"
              type="text"
              maxlength="80"
              placeholder="标题（可留空，保存时自动生成）"
              spellcheck="false"
              :disabled="saving || aiProcessing"
              @input="titleTouched = true"
            />
            <div class="struct-note-title-divider" aria-hidden="true" />
          </template>
        </StructNoteMarkdownEditor>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { generateNoteTitle } from '../../ai/aiService'
import { parseDraftTitleAndContent } from '../../ai/sedimentDraftService'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useStructNoteFragmentInsert } from '../../composables/useStructNoteFragmentInsert'
import {
  getFragmentContent,
} from '../../composables/useStructNoteFragments'
import StructNoteFolderBreadcrumb from './StructNoteFolderBreadcrumb.vue'
import StructNoteMarkdownEditor from './StructNoteMarkdownEditor.vue'
import StructNoteCopyButton from './StructNoteCopyButton.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  saving: {
    type: Boolean,
    default: false,
  },
  initialPathStack: {
    type: Array,
    default: () => [],
  },
  fragmentNotes: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'save', 'ai-unavailable', 'error'])

const { presets } = useMotionPresets()

const draftTitle = ref('')
const draftContent = ref('')
const titleTouched = ref(false)
const aiDraftTitle = ref('')
const titleInputRef = ref(null)
const contentEditorRef = ref(null)
const folderBreadcrumbRef = ref(null)
const pathStack = ref([])
const insertedFragmentIds = ref(new Set())
const introducedFragmentMethods = ref({})
const localFragmentNotes = ref([])
const fragmentsOpen = ref(false)

const {
  selectedInsertPreset,
  aiProcessing,
  processingFragmentId,
  insertFragment,
  insertAllFragments,
  stopInsertProcessing,
  disposeFragmentInsert,
} = useStructNoteFragmentInsert({
  draftContent,
  localFragmentNotes,
  insertedFragmentIds,
  introducedFragmentMethods,
  contentEditorRef,
  onAiUnavailable: () => emit('ai-unavailable'),
  onError: (error) => emit('error', error),
})

const canSave = computed(() => draftContent.value.trim().length > 0)

const allFragmentsInserted = computed(() => {
  if (!localFragmentNotes.value.length) return false
  return localFragmentNotes.value.every((note) =>
    insertedFragmentIds.value.has(String(note.id)),
  )
})

const currentParentId = computed(() => {
  const last = pathStack.value[pathStack.value.length - 1]
  return last?.id ?? 0
})

const resetDraft = () => {
  stopInsertProcessing()
  selectedInsertPreset.value = null
  draftTitle.value = ''
  draftContent.value = ''
  titleTouched.value = false
  aiDraftTitle.value = ''
  insertedFragmentIds.value = new Set()
  introducedFragmentMethods.value = {}
  localFragmentNotes.value = props.fragmentNotes.map((note) => ({ ...note }))
  fragmentsOpen.value = false
}

const closeFolderMenu = () => {
  folderBreadcrumbRef.value?.closeFolderMenu()
}

const emitClose = () => {
  if (props.saving) return
  stopInsertProcessing()
  closeFolderMenu()
  emit('close')
}

const resolveTitleForSave = async () => {
  const trimmed = draftTitle.value.trim()
  if (trimmed) return trimmed
  if (aiDraftTitle.value) return aiDraftTitle.value

  const content = draftContent.value.trim()
  if (content) {
    const { title } = parseDraftTitleAndContent(content)
    if (title) return title
  }

  if (localFragmentNotes.value.length) {
    const combined = localFragmentNotes.value
      .map((note) => getFragmentContent(note))
      .filter(Boolean)
      .join('\n')
    if (combined) {
      try {
        const aiTitle = await generateNoteTitle(combined)
        if (aiTitle) return aiTitle
      } catch {
        // fallback below
      }
    }
  }

  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = `${now.getMonth() + 1}`.padStart(2, '0')
  const dd = `${now.getDate()}`.padStart(2, '0')
  return `未命名长文 ${yyyy}-${mm}-${dd}`
}

const handleSave = async () => {
  if (!canSave.value || props.saving || aiProcessing.value) return

  const title = await resolveTitleForSave()
  const sourceFragmentIds = localFragmentNotes.value
    .map((note) => note?.id)
    .filter(Boolean)

  emit('save', {
    title,
    content: draftContent.value.trim(),
    parentId: currentParentId.value,
    pathStack: pathStack.value.map((item) => ({ id: item.id, name: item.name })),
    sourceFragmentIds,
    introducedFragmentIds: [...insertedFragmentIds.value].map(String).filter(Boolean),
    introducedFragmentMethods: { ...introducedFragmentMethods.value },
  })
}

const onKeydown = (event) => {
  if (!props.visible || props.saving) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (folderBreadcrumbRef.value?.handleEscape()) return
    if (aiProcessing.value) {
      stopInsertProcessing()
      return
    }
    emitClose()
  }
}

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      resetDraft()
      pathStack.value = props.initialPathStack.map((item) => ({
        id: item.id,
        name: item.name,
      }))
      closeFolderMenu()
      await nextTick()
      titleInputRef.value?.focus()
      window.addEventListener('keydown', onKeydown)
    } else {
      disposeFragmentInsert()
      closeFolderMenu()
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  disposeFragmentInsert()
  window.removeEventListener('keydown', onKeydown)
})

defineExpose({ resetDraft })
</script>

<style scoped>
.struct-note-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: #fbfaf9;
}

.struct-note-modal-header {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 18px 18px 0;
}

.struct-note-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
  cursor: pointer;
}

.struct-note-modal-close:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.1);
}

.struct-note-modal-close:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.struct-note-modal-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.struct-note-modal-header-actions {
  grid-column: 3;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.struct-note-modal-editor {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.struct-note-modal-editor :deep(.struct-note-editor-column) {
  padding: 8px 24px 0;
  box-sizing: border-box;
}

.struct-note-modal-editor :deep(.struct-note-md-editor) {
  padding-bottom: 8px;
}

.struct-note-title-input {
  flex: 0 0 auto;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 28px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: inherit;
  padding: 0;
  margin-bottom: 0;
  caret-color: var(--color-accent);
}

.struct-note-title-divider {
  flex: 0 0 auto;
  width: 100%;
  height: 1px;
  margin: 12px 0 14px;
  background: rgba(24, 24, 27, 0.1);
}

.struct-note-title-input::placeholder {
  color: #d1d5db;
}
</style>
