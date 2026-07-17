<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="struct-note-view"
        class="note-view-modal"
        :class="{ 'is-elevated': elevated }"
        role="dialog"
        aria-modal="true"
        :initial="{ opacity: 0, y: 28 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: 28 }"
        :transition="{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }"
      >
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

          <StructNoteFolderBreadcrumb
            ref="folderBreadcrumbRef"
            v-model:path-stack="pathStack"
            :disabled="saving || fetching || aiProcessing"
          />

          <div class="note-view-header-actions">
            <StructNoteCopyButton
              :get-content="() => draftContent"
              :disabled="fetching || loadError || saving || aiProcessing"
            />
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

        <div class="note-view-content-wrap">
          <p v-if="loadError" class="note-view-error">加载失败，请稍后重试</p>
          <p v-else-if="fetching" class="note-view-loading">加载中…</p>

          <StructNoteMarkdownEditor
            v-else
            ref="contentEditorRef"
            v-model="draftContent"
            v-model:fragment-notes="localFragmentNotes"
            v-model:fragments-open="fragmentsOpen"
            with-fragments
            :note-id="structNoteId"
            :inserted-ids="insertedFragmentIds"
            :inserted-id-list="insertedFragmentIdList"
            :restored-fragment-hint="restoredFragmentHint"
            :introduced-fragment-methods="introducedFragmentMethods"
            :selected-insert-preset="selectedInsertPreset"
            :ai-processing="aiProcessing"
            :processing-fragment-id="processingFragmentId"
            :all-fragments-inserted="allFragmentsInserted"
            :introduced-attachments="introducedAttachments"
            :fragments-mode="fragmentsMode"
            :restoring-id="restoringFragmentId"
            enable-fragment-picker
            :restorable-ids="baselineFragmentIds"
            :disabled="aiProcessing"
            class="note-view-editor"
            @insert="insertFragment"
            @insert-all="insertAllFragments"
            @cancel-fragment-intro="handleCancelFragmentIntro"
            @remove-introduced-attachment="removeIntroducedAttachmentByKey"
            @update:selected-insert-preset="selectedInsertPreset = $event"
            @restore="handleRestoreFragment"
            @image-too-large="emit('error', new Error('单张图片不能超过 10MB'))"
            @file-too-large="emit('error', new Error('单个附件不能超过 10MB'))"
          >
            <template #prefix>
              <input
                ref="titleInputRef"
                v-model="draftTitle"
                class="note-view-title-input"
                type="text"
                maxlength="80"
                placeholder="请输入标题"
                spellcheck="false"
                :disabled="aiProcessing"
              />
              <div class="struct-note-title-divider" aria-hidden="true" />
            </template>
          </StructNoteMarkdownEditor>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { getStructNote, updateStructNote, findStructFolderItemByNoteId } from '../../api/structNote'
import { fetchFolderPathStack, moveStructItem } from '../../api/structFolder'
import { fetchNotesByIds, restoreArchivedFragment, archiveFragmentNotes } from '../../api/note'
import {
  finalizeInlineImagesInMarkdown,
  hasPendingInlineImages,
} from '../../utils/attachmentMarkdown'
import { resolveIntroducedFragmentIds, normalizeIntroducedFragmentMethods, unmarkIntroducedFragments } from '../../composables/useStructNoteFragments'
import { useStructNoteFragmentInsert } from '../../composables/useStructNoteFragmentInsert'
import { useIntroducedFragmentAttachments } from '../../composables/useIntroducedFragmentAttachments'
import { useMotionPresets } from '../../composables/useMotionPresets'
import StructNoteFolderBreadcrumb from './StructNoteFolderBreadcrumb.vue'
import StructNoteMarkdownEditor from './StructNoteMarkdownEditor.vue'
import StructNoteCopyButton from './StructNoteCopyButton.vue'

const AUTO_SAVE_DELAY_MS = 1200

function normalizeParentId(parentId) {
  if (parentId == null || parentId === '' || parentId === 0 || parentId === '0') return 0
  return parentId
}

const props = defineProps({
  visible: { type: Boolean, default: false },
  noteItem: { type: Object, default: null },
  initialPathStack: {
    type: Array,
    default: () => [],
  },
  /** 盖在全局搜索之上时提高层级 */
  elevated: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'saved', 'fragment-restored', 'fragments-archived', 'error'])

const { presets } = useMotionPresets()

const note = ref({ title: '', name: '', content: '' })
const fetching = ref(false)
const loadError = ref(false)
const saving = ref(false)
const saveStatus = ref('idle')
const draftTitle = ref('')
const draftContent = ref('')
const lastSaved = ref({ title: '', content: '', parentId: 0 })
const titleInputRef = ref(null)
const contentEditorRef = ref(null)
const folderBreadcrumbRef = ref(null)
const pathStack = ref([])
const folderItemId = ref('')
const localFragmentNotes = ref([])
const insertedFragmentIds = ref(new Set())
const introducedFragmentMethods = ref({})
const fragmentsOpen = ref(false)
const fragmentsMode = ref('compose')
const sourceFragmentIds = ref([])
const baselineFragmentIds = ref([])
const restoringFragmentId = ref('')
const restoredFragmentHint = ref(null)

const insertedFragmentIdList = computed(() =>
  [...insertedFragmentIds.value].map((id) => String(id)).filter(Boolean),
)

const {
  items: introducedAttachments,
  addFromFragment,
  removeByKey: removeIntroducedAttachmentByKey,
  removeByFragmentIds: removeIntroducedAttachmentsByFragmentIds,
  reset: resetIntroducedAttachments,
  syncFromIntroducedFragments,
} = useIntroducedFragmentAttachments()

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
  introducedAttachments: { addFromFragment },
  contentEditorRef,
  onAiUnavailable: () => emit('error', new Error('请先在设置中配置 AI 服务')),
  onError: (error) => emit('error', error),
})

let autoSaveTimer = null
let loadToken = 0

const canSave = computed(() => draftContent.value.trim().length > 0)

const allFragmentsInserted = computed(() => {
  if (!localFragmentNotes.value.length) return false
  return localFragmentNotes.value.every((note) =>
    insertedFragmentIds.value.has(String(note.id)),
  )
})

const currentParentId = computed(() => {
  const last = pathStack.value[pathStack.value.length - 1]
  return normalizeParentId(last?.id ?? 0)
})

const isFolderDirty = computed(
  () => currentParentId.value !== normalizeParentId(lastSaved.value.parentId),
)

const isFragmentsDirty = computed(() => {
  const current = localFragmentNotes.value
    .map((note) => String(note?.id ?? ''))
    .filter(Boolean)
    .sort()
    .join(',')
  const baseline = [...baselineFragmentIds.value].sort().join(',')
  return current !== baseline
})

const isDirty = computed(
  () =>
    draftTitle.value.trim() !== lastSaved.value.title
    || draftContent.value.trim() !== lastSaved.value.content
    || isFolderDirty.value
    || isFragmentsDirty.value,
)

const saveButtonDisabled = computed(
  () => saving.value || aiProcessing.value || !canSave.value || (!isDirty.value && saveStatus.value === 'saved'),
)

const syncLastSavedFromDraft = () => {
  lastSaved.value = {
    title: draftTitle.value.trim(),
    content: draftContent.value.trim(),
    parentId: currentParentId.value,
  }
}

const resolveFolderContext = async (item) => {
  let folderItem = item?.type === 'note' && item?.id ? item : null
  const noteId = item?.noteId ?? item?.id ?? ''

  if (!folderItem?.id && noteId) {
    folderItem = await findStructFolderItemByNoteId(noteId)
  }

  folderItemId.value = folderItem?.id ? String(folderItem.id) : ''
  const parentId = normalizeParentId(folderItem?.parentId ?? 0)

  let stack = await fetchFolderPathStack(parentId)
  if (!stack.length && props.initialPathStack.length) {
    stack = props.initialPathStack.map((entry) => ({
      id: entry.id,
      name: entry.name,
    }))
  }

  pathStack.value = stack
  lastSaved.value = {
    ...lastSaved.value,
    parentId,
  }
}

const applyDraftFromNote = () => {
  draftTitle.value = note.value.title || note.value.name || ''
  draftContent.value = note.value.content || ''
  syncLastSavedFromDraft()
  saveStatus.value = 'saved'
}

const structNoteId = computed(
  () => props.noteItem?.noteId ?? props.noteItem?.id ?? note.value?.id ?? '',
)

const handleCancelFragmentIntro = (fragmentIds) => {
  const next = unmarkIntroducedFragments(
    insertedFragmentIds.value,
    introducedFragmentMethods.value,
    fragmentIds,
  )
  insertedFragmentIds.value = next.insertedIds
  introducedFragmentMethods.value = next.introducedMethods
  removeIntroducedAttachmentsByFragmentIds(fragmentIds)
}

const handleRestoreFragment = async (fragmentNote) => {
  const fragmentId = fragmentNote?.id
  const noteId = structNoteId.value
  if (!fragmentId || !noteId || restoringFragmentId.value) return

  restoringFragmentId.value = fragmentId
  try {
    const restored = await restoreArchivedFragment(fragmentId, noteId)
    sourceFragmentIds.value = sourceFragmentIds.value.filter(
      (id) => String(id) !== String(fragmentId),
    )
    baselineFragmentIds.value = [...sourceFragmentIds.value]
    localFragmentNotes.value = localFragmentNotes.value.filter(
      (item) => String(item.id) !== String(fragmentId),
    )
    insertedFragmentIds.value = new Set(
      [...insertedFragmentIds.value].filter((id) => String(id) !== String(fragmentId)),
    )
    const nextMethods = { ...introducedFragmentMethods.value }
    delete nextMethods[String(fragmentId)]
    introducedFragmentMethods.value = nextMethods
    removeIntroducedAttachmentsByFragmentIds([fragmentId])
    await updateStructNote({
      id: noteId,
      title: resolveTitleForSave(),
      content: draftContent.value.trim(),
      sourceFragmentIds: [...sourceFragmentIds.value],
      introducedFragmentIds: [...insertedFragmentIds.value],
      introducedFragmentMethods: nextMethods,
    })
    restoredFragmentHint.value = { note: restored, at: Date.now() }
    if (!localFragmentNotes.value.length) {
      fragmentsOpen.value = false
    }
    emit('fragment-restored', restored)
  } catch (err) {
    console.error(err)
  } finally {
    restoringFragmentId.value = ''
  }
}

const loadSourceFragments = async (ids = [], { preserveInserted = false } = {}) => {
  const preservedInsertedIds = preserveInserted
    ? new Set(insertedFragmentIds.value)
    : null
  const preservedMethods = preserveInserted
    ? { ...introducedFragmentMethods.value }
    : null
  const normalizedIds = (Array.isArray(ids) ? ids : [])
    .map((id) => String(id))
    .filter(Boolean)
  const fetched = normalizedIds.length ? await fetchNotesByIds(normalizedIds) : []
  const byId = new Map(fetched.map((note) => [String(note.id), note]))
  localFragmentNotes.value = normalizedIds.map((id) => byId.get(id)).filter(Boolean)
  baselineFragmentIds.value = normalizedIds
  fragmentsMode.value = localFragmentNotes.value.length ? 'source' : 'compose'
  if (preserveInserted && preservedInsertedIds) {
    insertedFragmentIds.value = preservedInsertedIds
  }
  if (preserveInserted && preservedMethods) {
    introducedFragmentMethods.value = preservedMethods
  }
}

const persistSourceFragments = async (noteId) => {
  const allFragmentIds = localFragmentNotes.value
    .map((note) => note?.id)
    .filter(Boolean)
    .map(String)
  const previousSet = new Set(sourceFragmentIds.value.map(String))
  const newIds = allFragmentIds.filter((id) => !previousSet.has(id))
  const fragmentsChanged =
    allFragmentIds.length !== previousSet.size
    || allFragmentIds.some((id) => !previousSet.has(id))

  let archivedIds = []
  if (newIds.length) {
    archivedIds = await archiveFragmentNotes(newIds, noteId)
  }

  sourceFragmentIds.value = allFragmentIds
  if (fragmentsChanged) {
    if (allFragmentIds.length) {
      await loadSourceFragments(allFragmentIds, { preserveInserted: true })
    } else {
      localFragmentNotes.value = []
      baselineFragmentIds.value = []
      fragmentsMode.value = 'compose'
    }
  }

  if (archivedIds.length) {
    emit('fragments-archived', archivedIds)
  }

  return allFragmentIds
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

const resolveTitleForSave = () => {
  const trimmed = draftTitle.value.trim()
  if (trimmed) return trimmed
  const content = draftContent.value.trim()
  if (content) {
    const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean)
    if (firstLine) {
      return firstLine.replace(/^#+\s*/, '').trim().slice(0, 80) || lastSaved.value.title
    }
  }
  return lastSaved.value.title || note.value.title || note.value.name || '未命名长文'
}

const handleSave = async (isAuto = false) => {
  if (!canSave.value || saving.value || aiProcessing.value) return
  if (!isDirty.value) return

  if (!isAuto) {
    saving.value = true
    saveStatus.value = 'saving'
  }
  const title = resolveTitleForSave()
  const noteId = props.noteItem.noteId ?? props.noteItem.id
  try {
    const allFragmentIds = localFragmentNotes.value
      .map((note) => note?.id)
      .filter(Boolean)
      .map(String)

    const introducedIds = [...insertedFragmentIds.value].map(String).filter(Boolean)

    let content = draftContent.value.trim()

    await updateStructNote({
      id: noteId,
      title,
      content,
      sourceFragmentIds: allFragmentIds,
      introducedFragmentIds: introducedIds,
      introducedFragmentMethods: { ...introducedFragmentMethods.value },
    })

    if (hasPendingInlineImages(content)) {
      const finalizedContent = await finalizeInlineImagesInMarkdown(noteId, content)
      if (finalizedContent !== content) {
        content = finalizedContent
        await updateStructNote({
          id: noteId,
          title,
          content,
          sourceFragmentIds: allFragmentIds,
          introducedFragmentIds: introducedIds,
          introducedFragmentMethods: { ...introducedFragmentMethods.value },
        })
        draftContent.value = finalizedContent
      }
    }

    if (isFolderDirty.value && folderItemId.value) {
      await moveStructItem({
        id: folderItemId.value,
        targetParentId: currentParentId.value,
      })
    }
    await persistSourceFragments(noteId)
    draftTitle.value = title
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
    if (!isAuto) {
      saving.value = false
    }
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
    sourceFragmentIds.value = Array.isArray(data?.sourceFragmentIds)
      ? [...data.sourceFragmentIds]
      : []
    await resolveFolderContext(props.noteItem)
    applyDraftFromNote()
    await loadSourceFragments(sourceFragmentIds.value)
    insertedFragmentIds.value = resolveIntroducedFragmentIds({
      sourceFragmentIds: sourceFragmentIds.value,
      introducedFragmentIds: data?.introducedFragmentIds,
      content: draftContent.value,
      fragmentNotes: localFragmentNotes.value,
    })
    introducedFragmentMethods.value = normalizeIntroducedFragmentMethods(
      data?.introducedFragmentMethods,
    )
    syncFromIntroducedFragments(localFragmentNotes.value, insertedFragmentIds.value)
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
  stopInsertProcessing()
  folderBreadcrumbRef.value?.closeFolderMenu()
  emit('close')
}

const onKeydown = (e) => {
  if (!props.visible || saving.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (folderBreadcrumbRef.value?.handleEscape()) return
    if (aiProcessing.value) {
      stopInsertProcessing()
      return
    }
    emitClose()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    handleSave(false)
  }
}

watch([draftTitle, draftContent, pathStack, localFragmentNotes], () => {
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
      lastSaved.value = { title: '', content: '', parentId: 0 }
      pathStack.value = []
      folderItemId.value = ''
      localFragmentNotes.value = []
      insertedFragmentIds.value = new Set()
      introducedFragmentMethods.value = {}
      resetIntroducedAttachments()
      fragmentsOpen.value = false
      fragmentsMode.value = 'compose'
      sourceFragmentIds.value = []
      baselineFragmentIds.value = []
      restoringFragmentId.value = ''
      restoredFragmentHint.value = null
      clearAutoSaveTimer()
      fetchDetail()
      window.addEventListener('keydown', onKeydown)
    } else {
      clearAutoSaveTimer()
      disposeFragmentInsert()
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  clearAutoSaveTimer()
  disposeFragmentInsert()
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

.note-view-modal.is-elevated {
  z-index: 220;
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

.note-view-content-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.note-view-content-wrap .note-view-loading,
.note-view-content-wrap .note-view-error {
  width: min(760px, 100%);
  margin: 16px auto 0;
  padding: 0 24px;
  box-sizing: border-box;
}

.note-view-editor {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.note-view-editor :deep(.struct-note-editor-layout) {
  padding-bottom: 32px;
}

.note-view-editor :deep(.struct-note-editor-column) {
  padding: 0 24px;
  box-sizing: border-box;
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

.struct-note-title-divider {
  flex: 0 0 auto;
  width: 100%;
  height: 1px;
  margin: 12px 0 6px;
  background: rgba(24, 24, 27, 0.1);
}

.note-view-title-input::placeholder {
  color: #d1d5db;
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
