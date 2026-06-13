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
            @click="emitClose"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </motion.button>

          <StructNoteFolderBreadcrumb
            ref="folderBreadcrumbRef"
            v-model:path-stack="pathStack"
            :disabled="saving"
          />

          <motion.button
            type="button"
            class="btn btn-primary struct-note-modal-save"
            :disabled="saving || !canSave"
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
          :disabled="saving"
          :inserted-ids="insertedFragmentIds"
          :min-height="240"
          @insert="insertFragment"
        >
          <template #prefix>
            <input
              ref="titleInputRef"
              v-model="draftTitle"
              class="struct-note-title-input"
              type="text"
              maxlength="80"
              placeholder="请输入标题"
              spellcheck="false"
              :disabled="saving"
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
import { useMotionPresets } from '../../composables/useMotionPresets'
import { appendFragmentToContent } from '../../composables/useStructNoteFragments'
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

const emit = defineEmits(['close', 'save'])

const { presets } = useMotionPresets()

const draftTitle = ref('')
const draftContent = ref('')
const titleInputRef = ref(null)
const contentEditorRef = ref(null)
const folderBreadcrumbRef = ref(null)
const pathStack = ref([])
const insertedFragmentIds = ref(new Set())
const localFragmentNotes = ref([])
const fragmentsOpen = ref(false)

const canSave = computed(() => draftTitle.value.trim().length > 0)

const currentParentId = computed(() => {
  const last = pathStack.value[pathStack.value.length - 1]
  return last?.id ?? 0
})

const resetDraft = () => {
  draftTitle.value = ''
  draftContent.value = ''
  insertedFragmentIds.value = new Set()
  localFragmentNotes.value = props.fragmentNotes.map((note) => ({ ...note }))
  fragmentsOpen.value = false
}

const closeFolderMenu = () => {
  folderBreadcrumbRef.value?.closeFolderMenu()
}

const emitClose = () => {
  if (props.saving) return
  closeFolderMenu()
  emit('close')
}

const handleSave = () => {
  if (!canSave.value || props.saving) return
  const sourceFragmentIds = localFragmentNotes.value
    .map((note) => note?.id)
    .filter(Boolean)
  emit('save', {
    title: draftTitle.value.trim(),
    content: draftContent.value.trim(),
    parentId: currentParentId.value,
    sourceFragmentIds,
  })
}

const insertFragment = (note) => {
  if (insertedFragmentIds.value.has(note.id)) return
  draftContent.value = appendFragmentToContent(draftContent.value, note)
  insertedFragmentIds.value = new Set([...insertedFragmentIds.value, note.id])
  nextTick(() => contentEditorRef.value?.focus())
}

const onKeydown = (event) => {
  if (!props.visible || props.saving) return
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
      closeFolderMenu()
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
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

.struct-note-modal-close:hover {
  background: rgba(24, 24, 27, 0.1);
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
