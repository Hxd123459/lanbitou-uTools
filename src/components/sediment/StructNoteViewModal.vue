<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="struct-note-view"
        class="note-view-modal"
        role="dialog"
        aria-modal="true"
        :initial="{ opacity: 0, y: 28 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: 28 }"
        :transition="{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }"
      >
        <div class="struct-note-drag-handle-mount" aria-hidden="true">
          <div class="struct-note-drag-handle-target" />
        </div>

        <header class="note-view-header">
          <motion.button
            type="button"
            class="note-view-close"
            aria-label="关闭"
            :disabled="saving"
            :while-hover="presets.button.hover"
            :while-tap="presets.button.tap"
            :transition="presets.button.transition"
            @click="emitClose"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </motion.button>

          <div class="note-view-header-actions">
            <motion.button
              v-if="!fragmentsOpen"
              type="button"
              class="note-view-fragments-toggle"
              aria-label="展开碎片面板"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="fragmentsOpen = true"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
              <span>碎片 {{ localFragmentNotes.length }}</span>
            </motion.button>

            <motion.button
              type="button"
              class="btn btn-primary note-view-save-btn"
              :class="{
                'is-saving': saving,
                'is-saved': saveStatus === 'saved' && !isDirty,
              }"
              :disabled="saveButtonDisabled"
              :while-hover="saveButtonDisabled ? undefined : presets.button.hover"
              :while-tap="saveButtonDisabled ? undefined : presets.button.tap"
              :transition="presets.button.transition"
              @click="handleSave(false)"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  v-if="saving"
                  key="saving"
                  class="note-view-save-label"
                  :initial="presets.swapLabel.initial"
                  :animate="presets.swapLabel.animate"
                  :exit="presets.swapLabel.exit"
                  :transition="presets.swapLabel.transition"
                >
                  <svg
                    class="note-view-save-icon note-view-save-icon--spin"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  保存中…
                </motion.span>
                <motion.span
                  v-else-if="saveStatus === 'saved' && !isDirty"
                  key="saved"
                  class="note-view-save-label"
                  :initial="presets.swapLabel.initial"
                  :animate="presets.swapLabel.animate"
                  :exit="presets.swapLabel.exit"
                  :transition="presets.swapLabel.transition"
                >
                  <svg
                    class="note-view-save-icon"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  已保存
                </motion.span>
                <motion.span
                  v-else
                  key="idle"
                  class="note-view-save-label"
                  :initial="presets.swapLabel.initial"
                  :animate="presets.swapLabel.animate"
                  :exit="presets.swapLabel.exit"
                  :transition="presets.swapLabel.transition"
                >
                  <svg
                    class="note-view-save-icon"
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
                  保存
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </header>

        <div class="note-view-content">
          <p v-if="loadError" class="note-view-error">加载失败，请稍后重试</p>
          <p v-else-if="fetching" class="note-view-loading">加载中…</p>

          <template v-else>
            <input
              ref="titleInputRef"
              v-model="draftTitle"
              class="note-view-title-input"
              type="text"
              maxlength="80"
              placeholder="请输入标题"
              spellcheck="false"
            />

            <div class="note-view-divider" />

            <StructNoteMarkdownEditor
              ref="contentEditorRef"
              v-model="draftContent"
              v-model:fragment-notes="localFragmentNotes"
              v-model:fragments-open="fragmentsOpen"
              with-fragments
              :inserted-ids="insertedFragmentIds"
              :show-expand-button="false"
              class="note-view-editor"
              @insert="insertFragment"
            />
          </template>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { getStructNote, updateStructNote } from '../../api/structNote'
import { appendFragmentToContent } from '../../composables/useStructNoteFragments'
import { useMotionPresets } from '../../composables/useMotionPresets'
import StructNoteMarkdownEditor from './StructNoteMarkdownEditor.vue'

const AUTO_SAVE_DELAY_MS = 1200

const props = defineProps({
  visible: { type: Boolean, default: false },
  noteItem: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const { presets } = useMotionPresets()

const note = ref({ title: '', name: '', content: '' })
const fetching = ref(false)
const loadError = ref(false)
const saving = ref(false)
const saveStatus = ref('idle')
const draftTitle = ref('')
const draftContent = ref('')
const lastSaved = ref({ title: '', content: '' })
const titleInputRef = ref(null)
const contentEditorRef = ref(null)
const localFragmentNotes = ref([])
const insertedFragmentIds = ref(new Set())
const fragmentsOpen = ref(false)

let autoSaveTimer = null
let loadToken = 0

const canSave = computed(() => draftTitle.value.trim().length > 0)

const isDirty = computed(
  () =>
    draftTitle.value.trim() !== lastSaved.value.title
    || draftContent.value.trim() !== lastSaved.value.content,
)

const saveButtonDisabled = computed(
  () => saving.value || !canSave.value || (!isDirty.value && saveStatus.value === 'saved'),
)

const syncLastSavedFromDraft = () => {
  lastSaved.value = {
    title: draftTitle.value.trim(),
    content: draftContent.value.trim(),
  }
}

const applyDraftFromNote = () => {
  draftTitle.value = note.value.title || note.value.name || ''
  draftContent.value = note.value.content || ''
  syncLastSavedFromDraft()
  saveStatus.value = 'saved'
}

const insertFragment = (fragmentNote) => {
  if (insertedFragmentIds.value.has(fragmentNote.id)) return
  draftContent.value = appendFragmentToContent(draftContent.value, fragmentNote)
  insertedFragmentIds.value = new Set([...insertedFragmentIds.value, fragmentNote.id])
  nextTick(() => contentEditorRef.value?.focus())
}

const clearAutoSaveTimer = () => {
  if (autoSaveTimer != null) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
}

const scheduleAutoSave = () => {
  clearAutoSaveTimer()
  if (!props.visible || fetching.value || loadError.value || !canSave.value || !isDirty.value) {
    return
  }
  autoSaveTimer = window.setTimeout(() => {
    autoSaveTimer = null
    handleSave(true)
  }, AUTO_SAVE_DELAY_MS)
}

const handleSave = async (isAuto = false) => {
  if (!canSave.value || saving.value) return
  if (!isDirty.value) return

  saving.value = true
  saveStatus.value = 'saving'
  try {
    await updateStructNote({
      id: props.noteItem.noteId ?? props.noteItem.id,
      title: draftTitle.value.trim(),
      content: draftContent.value.trim(),
    })
    const title = draftTitle.value.trim()
    const content = draftContent.value.trim()
    note.value = { ...note.value, title, name: title, content }
    syncLastSavedFromDraft()
    saveStatus.value = 'saved'
    emit('saved')
  } catch (err) {
    console.error(err)
    if (!isAuto) {
      saveStatus.value = 'idle'
    }
  } finally {
    saving.value = false
  }
}

const fetchDetail = async () => {
  if (!props.noteItem) return
  const token = ++loadToken
  fetching.value = true
  loadError.value = false
  try {
    const data = await getStructNote(props.noteItem.noteId ?? props.noteItem.id)
    if (token !== loadToken) return
    note.value = { ...props.noteItem, ...data }
    applyDraftFromNote()
    await nextTick()
    titleInputRef.value?.focus()
  } catch {
    if (token !== loadToken) return
    loadError.value = true
    note.value = { ...props.noteItem, content: '' }
  } finally {
    if (token === loadToken) {
      fetching.value = false
    }
  }
}

const emitClose = () => {
  if (saving.value) return
  emit('close')
}

const onKeydown = (e) => {
  if (!props.visible || saving.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emitClose()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    handleSave(false)
  }
}

watch([draftTitle, draftContent], () => {
  if (!props.visible || fetching.value || loadError.value) return
  if (isDirty.value && saveStatus.value === 'saved') {
    saveStatus.value = 'idle'
  }
  scheduleAutoSave()
})

watch(
  () => props.visible,
  (open) => {
    if (open) {
      saveStatus.value = 'idle'
      note.value = { ...props.noteItem, content: '' }
      draftTitle.value = ''
      draftContent.value = ''
      lastSaved.value = { title: '', content: '' }
      localFragmentNotes.value = []
      insertedFragmentIds.value = new Set()
      fragmentsOpen.value = false
      clearAutoSaveTimer()
      fetchDetail()
      window.addEventListener('keydown', onKeydown)
    } else {
      clearAutoSaveTimer()
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  clearAutoSaveTimer()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.note-view-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: #fbfaf9;
}

.note-view-header {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 18px 18px 0;
  flex: 0 0 auto;
}

.note-view-close {
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

.note-view-close:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.1);
}

.note-view-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.note-view-header-actions {
  grid-column: 3;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.note-view-fragments-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.note-view-fragments-toggle:hover {
  background: rgba(24, 24, 27, 0.1);
  color: var(--color-primary);
}

.note-view-save-btn {
  min-width: 108px;
}

.note-view-save-btn.is-saved:disabled {
  opacity: var(--btn-disabled-opacity, 0.55);
  cursor: default;
  filter: saturate(0.85);
}

.note-view-save-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.note-view-save-icon {
  flex: 0 0 auto;
}

.note-view-save-icon--spin {
  animation: note-view-save-spin 0.85s linear infinite;
}

@keyframes note-view-save-spin {
  to {
    transform: rotate(360deg);
  }
}

.note-view-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 16px 24px 0;
  box-sizing: border-box;
  overflow: hidden;
}

.note-view-content .note-view-title-input,
.note-view-content .note-view-divider {
  flex: 0 0 auto;
}

.note-view-content .note-view-title-input {
  width: 100%;
  max-width: 100%;
  margin-left: 0;
  padding-left: 0;
}

.note-view-content :deep(.struct-note-editor-layout) {
  flex: 1;
  min-height: 0;
  padding-inline: 0;
  padding-bottom: 32px;
}

.note-view-editor {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.note-view-title-input {
  flex: 0 0 auto;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 28px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: inherit;
  padding: 8px 0 0;
  margin-bottom: 0;
  caret-color: var(--color-accent);
}

.note-view-title-input::placeholder {
  color: #d1d5db;
}

.note-view-divider {
  height: 1px;
  background: rgba(24, 24, 27, 0.07);
  margin: 18px 0 12px;
  flex: 0 0 auto;
}

.note-view-loading,
.note-view-error {
  font-size: 14px;
  color: var(--color-secondary-text);
  margin: 0;
}

.note-view-error {
  color: #ef4444;
}
</style>
