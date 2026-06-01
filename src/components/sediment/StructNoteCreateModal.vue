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

          <nav class="struct-note-breadcrumb" aria-label="保存位置">
            <ol class="breadcrumb-list">
              <li
                v-for="(crumb, index) in breadcrumbs"
                :key="`${crumb.label}-${index}`"
                class="breadcrumb-item"
              >
                <motion.button
                  v-if="index < breadcrumbs.length - 1"
                  type="button"
                  class="breadcrumb-link"
                  :while-hover="presets.button.hover"
                  :while-tap="presets.button.tap"
                  :transition="presets.button.transition"
                  @click="navigateToCrumb(index)"
                >
                  <svg
                    v-if="index === 0"
                    class="breadcrumb-folder-icon"
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                  </svg>
                  {{ crumb.label }}
                </motion.button>
                <div
                  v-else
                  ref="currentCrumbRef"
                  class="breadcrumb-current-wrap"
                >
                  <span class="breadcrumb-current" aria-current="page">
                    <svg
                      v-if="index === 0"
                      class="breadcrumb-folder-icon"
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                    </svg>
                    {{ crumb.label }}
                  </span>
                  <div class="breadcrumb-toggle-anchor">
                    <button
                      type="button"
                      class="breadcrumb-folder-toggle"
                      :class="{ 'is-open': folderMenuOpen }"
                      :aria-expanded="folderMenuOpen"
                      aria-label="选择文件夹"
                      @mousedown.prevent
                      @click.stop="toggleFolderMenu"
                    >
                      <motion.svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        aria-hidden="true"
                        :animate="{ rotate: folderMenuOpen ? 180 : 0 }"
                        :transition="{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </motion.svg>
                    </button>

                    <AnimatePresence>
                      <motion.div
                        v-if="folderMenuOpen"
                        key="folder-menu"
                        class="breadcrumb-folder-menu"
                        role="listbox"
                        aria-label="子文件夹"
                        :initial="{ opacity: 0, y: -8, scale: 0.96 }"
                        :animate="{ opacity: 1, y: 0, scale: 1 }"
                        :exit="{ opacity: 0, y: -8, scale: 0.96 }"
                        :transition="{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }"
                        @mousedown.stop
                      >
                        <p v-if="folderMenuLoading" class="breadcrumb-folder-state">加载中…</p>
                        <template v-else>
                          <p v-if="!folderMenuItems.length" class="breadcrumb-folder-state">暂无子文件夹</p>
                          <button
                            v-for="folder in folderMenuItems"
                            :key="folder.id"
                            type="button"
                            class="breadcrumb-folder-option"
                            role="option"
                            @click="enterFolderFromMenu(folder)"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                            </svg>
                            <span>{{ folder.name }}</span>
                          </button>

                          <div v-if="creatingFolder" class="breadcrumb-folder-create">
                            <input
                              ref="folderNameInputRef"
                              v-model="draftFolderName"
                              class="breadcrumb-folder-input"
                              type="text"
                              maxlength="40"
                              placeholder="文件夹名称"
                              :disabled="folderCreating"
                              @keydown.enter.prevent="confirmCreateFolder"
                              @keydown.esc.prevent="cancelCreateFolder"
                              @blur="onFolderInputBlur"
                            />
                          </div>
                          <button
                            v-else
                            type="button"
                            class="breadcrumb-folder-create-btn"
                            @click="startCreateFolder"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                              <line x1="12" y1="11" x2="12" y2="17" />
                              <line x1="9" y1="14" x2="15" y2="14" />
                            </svg>
                            <span>新建文件夹</span>
                          </button>
                        </template>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                <span
                  v-if="index < breadcrumbs.length - 1"
                  class="breadcrumb-sep"
                  aria-hidden="true"
                >
                  /
                </span>
              </li>
            </ol>
          </nav>

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

        <div
          class="struct-note-modal-layout"
          :class="{ 'is-fragments-open': hasFragments && fragmentsPanelOpen }"
        >
          <div class="struct-note-editor-zone">
            <div class="struct-note-modal-body">
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
              <StructNoteMarkdownEditor
                ref="contentEditorRef"
                v-model="draftContent"
                :disabled="saving"
                :min-height="240"
              />
            </div>
          </div>

          <AnimatePresence>
            <motion.aside
              v-if="hasFragments && fragmentsPanelOpen"
              key="fragments-panel"
              class="struct-note-fragments"
              aria-label="已选碎片笔记"
              :initial="{ width: 0, opacity: 0, x: 16 }"
              :animate="{ width: 300, opacity: 1, x: 0 }"
              :exit="{ width: 0, opacity: 0, x: 16 }"
              :transition="{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }"
            >
              <div class="struct-note-fragments-inner">
                <div class="struct-note-fragments-head">
                  <h3 class="struct-note-fragments-title">已选碎片（{{ fragmentNotes.length }}）</h3>
                  <motion.button
                    type="button"
                    class="struct-note-fragments-collapse"
                    aria-label="收起碎片面板"
                    :while-hover="presets.button.hover"
                    :while-tap="presets.button.tap"
                    :transition="presets.button.transition"
                    @click="fragmentsPanelOpen = false"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </motion.button>
                </div>
                <ul class="struct-note-fragments-list">
                  <li
                    v-for="note in fragmentNotes"
                    :key="note.id"
                    class="struct-note-fragment-item"
                  >
                    <motion.button
                      type="button"
                      class="struct-note-fragment-add"
                      :class="{ 'is-added': insertedFragmentIds.has(note.id) }"
                      :disabled="saving || insertedFragmentIds.has(note.id)"
                      :aria-label="insertedFragmentIds.has(note.id) ? '已加入' : '加入笔记'"
                      :while-hover="presets.button.hover"
                      :while-tap="presets.button.tap"
                      :transition="presets.button.transition"
                      @click="insertFragment(note)"
                    >
                      <svg
                        v-if="insertedFragmentIds.has(note.id)"
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                      <svg
                        v-else
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        aria-hidden="true"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </motion.button>
                    <div class="struct-note-fragment-main">
                      <p class="struct-note-fragment-title">
                        {{ getFragmentTitle(note) }}
                      </p>
                      <p class="struct-note-fragment-preview">
                        {{ getFragmentPreview(note) }}
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </motion.aside>
          </AnimatePresence>

          <motion.button
            v-if="hasFragments && !fragmentsPanelOpen"
            type="button"
            class="struct-note-fragments-expand"
            aria-label="展开碎片面板"
            :while-hover="presets.button.hover"
            :while-tap="presets.button.tap"
            :transition="presets.button.transition"
            @click="fragmentsPanelOpen = true"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span>碎片 {{ fragmentNotes.length }}</span>
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { createStructFolder, fetchFolderList } from '../../api/structFolder'
import { useMotionPresets } from '../../composables/useMotionPresets'
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
const pathStack = ref([])
const folderMenuOpen = ref(false)
const folderMenuLoading = ref(false)
const folderMenuItems = ref([])
const insertedFragmentIds = ref(new Set())
const currentCrumbRef = ref(null)
const fragmentsPanelOpen = ref(true)
const creatingFolder = ref(false)
const draftFolderName = ref('')
const folderCreating = ref(false)
const folderNameInputRef = ref(null)

const hasFragments = computed(() => props.fragmentNotes.length > 0)
const canSave = computed(() => draftTitle.value.trim().length > 0)

const currentParentId = computed(() => {
  const last = pathStack.value[pathStack.value.length - 1]
  return last?.id ?? 0
})

const breadcrumbs = computed(() => [
  { id: null, label: '沉淀' },
  ...pathStack.value.map((item) => ({ id: item.id, label: item.name })),
])

const resetDraft = () => {
  draftTitle.value = ''
  draftContent.value = ''
  insertedFragmentIds.value = new Set()
  fragmentsPanelOpen.value = true
  creatingFolder.value = false
  draftFolderName.value = ''
}

const closeFolderMenu = () => {
  folderMenuOpen.value = false
  creatingFolder.value = false
  draftFolderName.value = ''
}

const emitClose = () => {
  if (props.saving) return
  closeFolderMenu()
  emit('close')
}

const handleSave = () => {
  if (!canSave.value || props.saving) return
  emit('save', {
    title: draftTitle.value.trim(),
    content: draftContent.value.trim(),
    parentId: currentParentId.value,
  })
}

const navigateToCrumb = (index) => {
  closeFolderMenu()
  pathStack.value = pathStack.value.slice(0, index)
}

const loadFolderMenuItems = async () => {
  folderMenuLoading.value = true
  try {
    const list = await fetchFolderList(currentParentId.value)
    folderMenuItems.value = list.filter((item) => item.type === 'folder')
  } catch {
    folderMenuItems.value = []
  } finally {
    folderMenuLoading.value = false
  }
}

const toggleFolderMenu = async () => {
  if (folderMenuOpen.value) {
    closeFolderMenu()
    return
  }
  folderMenuOpen.value = true
  await loadFolderMenuItems()
}

const enterFolderFromMenu = async (folder) => {
  if (folder.type !== 'folder') return
  pathStack.value = [...pathStack.value, { id: folder.id, name: folder.name }]
  creatingFolder.value = false
  draftFolderName.value = ''
  await loadFolderMenuItems()
}

const startCreateFolder = async () => {
  creatingFolder.value = true
  draftFolderName.value = ''
  await nextTick()
  folderNameInputRef.value?.focus()
}

const cancelCreateFolder = () => {
  if (folderCreating.value) return
  creatingFolder.value = false
  draftFolderName.value = ''
}

const onFolderInputBlur = () => {
  if (folderCreating.value) return
  cancelCreateFolder()
}

const confirmCreateFolder = async () => {
  const name = draftFolderName.value.trim()
  if (!name || folderCreating.value) {
    cancelCreateFolder()
    return
  }

  folderCreating.value = true
  try {
    await createStructFolder({
      parentId: currentParentId.value,
      name,
    })
    creatingFolder.value = false
    draftFolderName.value = ''
    await loadFolderMenuItems()
  } catch {
    cancelCreateFolder()
  } finally {
    folderCreating.value = false
  }
}

const getFragmentTitle = (note) =>
  note?.title || note?.fineTitle || '无标题'

const getFragmentContent = (note) =>
  note?.markdownContent || note?.text || note?.summary || ''

const getFragmentPreview = (note) => {
  const text = getFragmentContent(note).replace(/\s+/g, ' ').trim()
  if (!text) return '（暂无内容）'
  return text.length > 72 ? `${text.slice(0, 72)}…` : text
}

const insertFragment = (note) => {
  if (insertedFragmentIds.value.has(note.id)) return
  const title = getFragmentTitle(note)
  const body = getFragmentContent(note)
  const block = body ? `## ${title}\n\n${body}` : `## ${title}`
  draftContent.value = draftContent.value.trim()
    ? `${draftContent.value.trim()}\n\n${block}`
    : block
  insertedFragmentIds.value = new Set([...insertedFragmentIds.value, note.id])
  nextTick(() => contentEditorRef.value?.focus())
}

const onKeydown = (event) => {
  if (!props.visible || props.saving) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (creatingFolder.value) {
      cancelCreateFolder()
      return
    }
    if (folderMenuOpen.value) {
      closeFolderMenu()
      return
    }
    emitClose()
  }
}

const onDocumentPointerdown = (event) => {
  if (!folderMenuOpen.value) return
  const anchor = Array.isArray(currentCrumbRef.value)
    ? currentCrumbRef.value[0]
    : currentCrumbRef.value
  if (anchor?.contains(event.target)) return
  closeFolderMenu()
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
      document.addEventListener('pointerdown', onDocumentPointerdown)
    } else {
      closeFolderMenu()
      window.removeEventListener('keydown', onKeydown)
      document.removeEventListener('pointerdown', onDocumentPointerdown)
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerdown)
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

.struct-note-breadcrumb {
  min-width: 0;
  justify-self: center;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.breadcrumb-link,
.breadcrumb-current {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.breadcrumb-link {
  border: 0;
  background: transparent;
  padding: 2px 4px;
  border-radius: 6px;
  color: var(--color-secondary-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.breadcrumb-link:hover {
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-primary);
}

.breadcrumb-folder-icon {
  flex: 0 0 auto;
  color: var(--color-secondary-text);
}

.breadcrumb-current-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.breadcrumb-current {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.breadcrumb-toggle-anchor {
  position: relative;
  flex: 0 0 auto;
}

.breadcrumb-folder-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
  outline: none;
  box-shadow: none;
  -webkit-tap-highlight-color: transparent;
}

.breadcrumb-folder-toggle:hover,
.breadcrumb-folder-toggle.is-open {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
}

.breadcrumb-folder-toggle:focus,
.breadcrumb-folder-toggle:focus-visible,
.breadcrumb-folder-toggle:active {
  outline: none !important;
  box-shadow: none !important;
  border: 0;
}

.breadcrumb-folder-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 5;
  min-width: 196px;
  max-width: min(280px, 70vw);
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
  transform-origin: top left;
}

.breadcrumb-folder-state {
  margin: 0;
  padding: 8px 10px;
  color: var(--color-secondary-text);
  font-size: 13px;
}

.breadcrumb-folder-option,
.breadcrumb-folder-create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.breadcrumb-folder-option:hover,
.breadcrumb-folder-create-btn:hover {
  background: rgba(24, 24, 27, 0.05);
}

.breadcrumb-folder-option span,
.breadcrumb-folder-create-btn span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb-folder-create {
  padding: 4px 6px 2px;
}

.breadcrumb-folder-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-primary);
  background: #fff;
  outline: none;
}

.breadcrumb-folder-input:focus {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.breadcrumb-folder-create-btn {
  margin-top: 2px;
  color: var(--color-accent);
}

.breadcrumb-sep {
  color: #a1a1aa;
  font-size: 12px;
  user-select: none;
}

.struct-note-modal-save {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.struct-note-modal-layout {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 16px 18px 32px;
  box-sizing: border-box;
}

.struct-note-editor-zone {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  justify-content: center;
  transition: justify-content 0.24s ease;
}

.struct-note-modal-layout.is-fragments-open .struct-note-editor-zone {
  justify-content: center;
}

.struct-note-modal-body {
  flex: 0 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  padding: 24px 24px 0;
  box-sizing: border-box;
}

.struct-note-fragments {
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid var(--color-border);
}

.struct-note-fragments-inner {
  width: 300px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 0 0 20px;
  box-sizing: border-box;
}

.struct-note-fragments-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.struct-note-fragments-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-secondary-text);
}

.struct-note-fragments-collapse,
.struct-note-fragments-expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
  cursor: pointer;
}

.struct-note-fragments-collapse {
  width: 28px;
  height: 28px;
  padding: 0;
}

.struct-note-fragments-expand {
  position: absolute;
  top: 24px;
  right: 18px;
  z-index: 3;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
}

.struct-note-fragments-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0 4px 0 0;
  list-style: none;
}

.struct-note-fragment-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
}

.struct-note-fragment-main {
  flex: 1;
  min-width: 0;
}

.struct-note-fragment-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.struct-note-fragment-preview {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.struct-note-fragment-add {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--btn-radius);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  box-shadow: var(--btn-primary-shadow);
  cursor: pointer;
}

.struct-note-fragment-add:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
  box-shadow: var(--btn-primary-shadow-hover);
}

.struct-note-fragment-add:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
  box-shadow: none;
}

.struct-note-fragment-add.is-added {
  background: var(--btn-icon-bg-hover);
  color: var(--color-secondary-text);
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
  margin-bottom: 20px;
  caret-color: var(--color-accent);
}

.struct-note-title-input::placeholder {
  color: #d1d5db;
}

@media (max-width: 900px) {
  .struct-note-modal-layout {
    flex-direction: column;
  }

  .struct-note-fragments-inner {
    width: 100%;
    max-height: 220px;
    padding-top: 16px;
  }

  .struct-note-fragments {
    border-left: 0;
    border-top: 1px solid var(--color-border);
  }

  .struct-note-modal-body {
    padding-top: 12px;
  }

  .struct-note-fragments-expand {
    top: auto;
    bottom: 16px;
  }
}
</style>
