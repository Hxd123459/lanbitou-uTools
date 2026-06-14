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
            :disabled="aiGenerating"
            @click="emitClose"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </motion.button>

          <StructNoteFolderBreadcrumb
            ref="folderBreadcrumbRef"
            v-model:path-stack="pathStack"
            :disabled="saving || aiGenerating"
          />

          <motion.button
            type="button"
            class="btn btn-primary struct-note-modal-save"
            :disabled="saving || aiGenerating || !canSave"
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
        </header>

        <StructNoteMarkdownEditor
          ref="contentEditorRef"
          v-model="draftContent"
          v-model:fragment-notes="localFragmentNotes"
          v-model:fragments-open="fragmentsOpen"
          class="struct-note-modal-editor"
          with-fragments
          :disabled="saving || aiGenerating"
          :inserted-ids="insertedFragmentIds"
          :min-height="240"
          @insert="insertFragment"
        >
          <template #prefix>
            <p
              v-if="localFragmentNotes.length"
              class="struct-note-source-summary"
            >
              将由 {{ localFragmentNotes.length }} 条碎片沉淀 · 保存后移出碎片列表
            </p>

            <input
              ref="titleInputRef"
              v-model="draftTitle"
              class="struct-note-title-input"
              type="text"
              maxlength="80"
              placeholder="标题（可留空，保存时自动生成）"
              spellcheck="false"
              :disabled="saving || aiGenerating"
              @input="titleTouched = true"
            />

            <div v-if="localFragmentNotes.length" class="struct-note-create-actions">
              <button
                type="button"
                class="struct-note-insert-all-btn"
                :disabled="saving || aiGenerating || allFragmentsInserted"
                @click="insertAllFragments"
              >
                全部插入
              </button>
            </div>

            <StructNoteAiDraftBar
              v-if="localFragmentNotes.length"
              :disabled="saving"
              :generating="aiGenerating"
              :active-preset="activePreset"
              @draft-request="handleDraftRequest"
            />
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
import {
  generateSedimentDraft,
  isSedimentDraftAiAvailable,
  parseDraftTitleAndContent,
} from '../../ai/sedimentDraftService'
import { useMotionPresets } from '../../composables/useMotionPresets'
import {
  appendFragmentToContent,
  getFragmentContent,
} from '../../composables/useStructNoteFragments'
import StructNoteAiDraftBar from './StructNoteAiDraftBar.vue'
import StructNoteFolderBreadcrumb from './StructNoteFolderBreadcrumb.vue'
import StructNoteMarkdownEditor from './StructNoteMarkdownEditor.vue'

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
const localFragmentNotes = ref([])
const fragmentsOpen = ref(false)
const aiGenerating = ref(false)
const activePreset = ref('')
let cancelDraft = null

const canSave = computed(() => draftContent.value.trim().length > 0)

const allFragmentsInserted = computed(() => {
  if (!localFragmentNotes.value.length) return false
  return localFragmentNotes.value.every((note) =>
    insertedFragmentIds.value.has(note.id),
  )
})

const currentParentId = computed(() => {
  const last = pathStack.value[pathStack.value.length - 1]
  return last?.id ?? 0
})

const resetDraft = () => {
  cancelDraft?.()
  cancelDraft = null
  aiGenerating.value = false
  activePreset.value = ''
  draftTitle.value = ''
  draftContent.value = ''
  titleTouched.value = false
  aiDraftTitle.value = ''
  insertedFragmentIds.value = new Set()
  localFragmentNotes.value = props.fragmentNotes.map((note) => ({ ...note }))
  fragmentsOpen.value = localFragmentNotes.value.length > 0
}

const closeFolderMenu = () => {
  folderBreadcrumbRef.value?.closeFolderMenu()
}

const emitClose = () => {
  if (props.saving || aiGenerating.value) return
  closeFolderMenu()
  emit('close')
}

const markAllFragmentsInserted = () => {
  const ids = localFragmentNotes.value
    .map((note) => note?.id)
    .filter(Boolean)
  insertedFragmentIds.value = new Set(ids)
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
  if (!canSave.value || props.saving || aiGenerating.value) return

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
  })
}

const insertFragment = (note) => {
  if (insertedFragmentIds.value.has(note.id)) return
  draftContent.value = appendFragmentToContent(draftContent.value, note)
  insertedFragmentIds.value = new Set([...insertedFragmentIds.value, note.id])
  nextTick(() => contentEditorRef.value?.focus())
}

const insertAllFragments = () => {
  for (const note of localFragmentNotes.value) {
    if (!insertedFragmentIds.value.has(note.id)) {
      insertFragment(note)
    }
  }
}

const handleDraftRequest = ({ preset, customPrompt }) => {
  if (!localFragmentNotes.value.length) return

  if (!isSedimentDraftAiAvailable()) {
    emit('ai-unavailable')
    return
  }

  if (draftContent.value.trim()) {
    const confirmed = window.confirm('AI 整理将覆盖当前正文，是否继续？')
    if (!confirmed) return
  }

  cancelDraft?.()
  aiGenerating.value = true
  activePreset.value = preset || 'compose'
  draftContent.value = ''
  contentEditorRef.value?.setMarkdownContent('', { emitUpdate: false })

  let draftAccumulated = ''

  cancelDraft = generateSedimentDraft({
    fragments: localFragmentNotes.value,
    preset: preset || 'compose',
    customPrompt,
    onDelta: (chunk, accumulated) => {
      draftAccumulated = accumulated
      contentEditorRef.value?.appendMarkdownChunk(chunk)
    },
    onTitle: (title) => {
      if (!titleTouched.value && title) {
        draftTitle.value = title
        aiDraftTitle.value = title
      }
    },
    onDone: ({ title, content }) => {
      aiGenerating.value = false
      activePreset.value = ''

      if (!titleTouched.value && title) {
        draftTitle.value = title
        aiDraftTitle.value = title
      }

      const body =
        content || parseDraftTitleAndContent(draftAccumulated).content || draftAccumulated
      draftContent.value = body
      contentEditorRef.value?.setMarkdownContent(body, { emitUpdate: true })
      markAllFragmentsInserted()
      cancelDraft = null
      nextTick(() => contentEditorRef.value?.focus())
    },
    onError: (error) => {
      aiGenerating.value = false
      activePreset.value = ''
      cancelDraft = null
      emit('error', error)
    },
  })
}

const onKeydown = (event) => {
  if (!props.visible || props.saving || aiGenerating.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (folderBreadcrumbRef.value?.handleEscape()) return
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
      cancelDraft?.()
      cancelDraft = null
      closeFolderMenu()
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  cancelDraft?.()
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
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.struct-note-source-summary {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--color-secondary-text);
  line-height: 1.5;
}

.struct-note-create-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.struct-note-insert-all-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.struct-note-insert-all-btn:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.28);
  background: #fff;
}

.struct-note-insert-all-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
  margin-bottom: 8px;
  caret-color: var(--color-accent);
}

.struct-note-title-input::placeholder {
  color: #d1d5db;
}
</style>
