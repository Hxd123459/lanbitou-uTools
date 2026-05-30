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
                  {{ crumb.label }}
                </motion.button>
                <div
                  v-else
                  ref="currentCrumbRef"
                  class="breadcrumb-current-wrap"
                >
                  <span class="breadcrumb-current" aria-current="page">
                    {{ crumb.label }}
                  </span>
                  <motion.button
                    type="button"
                    class="breadcrumb-folder-toggle"
                    :class="{ 'is-open': folderMenuOpen }"
                    :aria-expanded="folderMenuOpen"
                    aria-label="选择文件夹"
                    :while-hover="presets.button.hover"
                    :while-tap="presets.button.tap"
                    :transition="presets.button.transition"
                    @click.stop="toggleFolderMenu"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </motion.button>
                  <div
                    v-if="folderMenuOpen"
                    class="breadcrumb-folder-menu"
                    role="listbox"
                    aria-label="同级文件夹"
                  >
                    <p v-if="folderMenuLoading" class="breadcrumb-folder-state">加载中…</p>
                    <p v-else-if="!folderMenuItems.length" class="breadcrumb-folder-state">暂无文件夹</p>
                    <button
                      v-for="folder in folderMenuItems"
                      :key="folder.id"
                      type="button"
                      class="breadcrumb-folder-option"
                      :class="{ 'is-active': folder.id === currentFolderId }"
                      role="option"
                      :aria-selected="folder.id === currentFolderId"
                      @click="enterFolderFromMenu(folder)"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                      </svg>
                      <span>{{ folder.name }}</span>
                    </button>
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
            {{ saving ? '保存中…' : '保存' }}
          </motion.button>
        </header>

        <div class="struct-note-modal-layout">
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
            <textarea
              ref="contentTextareaRef"
              v-model="draftContent"
              class="struct-note-content-textarea"
              placeholder="开始写作…"
              spellcheck="false"
              :disabled="saving"
            />
          </div>

          <aside
            v-if="fragmentNotes.length"
            class="struct-note-fragments"
            aria-label="已选碎片笔记"
          >
            <h3 class="struct-note-fragments-title">已选碎片（{{ fragmentNotes.length }}）</h3>
            <ul class="struct-note-fragments-list">
              <li
                v-for="note in fragmentNotes"
                :key="note.id"
                class="struct-note-fragment-item"
              >
                <div class="struct-note-fragment-main">
                  <p class="struct-note-fragment-title">
                    {{ getFragmentTitle(note) }}
                  </p>
                  <p class="struct-note-fragment-preview">
                    {{ getFragmentPreview(note) }}
                  </p>
                </div>
                <motion.button
                  type="button"
                  class="struct-note-fragment-add"
                  :disabled="saving || insertedFragmentIds.has(note.id)"
                  :while-hover="presets.button.hover"
                  :while-tap="presets.button.tap"
                  :transition="presets.button.transition"
                  @click="insertFragment(note)"
                >
                  {{ insertedFragmentIds.has(note.id) ? '已加入' : '加入' }}
                </motion.button>
              </li>
            </ul>
          </aside>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { fetchFolderList } from '../../api/structFolder'
import { useMotionPresets } from '../../composables/useMotionPresets'

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
const contentTextareaRef = ref(null)
const pathStack = ref([])
const folderMenuOpen = ref(false)
const folderMenuLoading = ref(false)
const folderMenuItems = ref([])
const insertedFragmentIds = ref(new Set())
const currentCrumbRef = ref(null)

const canSave = computed(() => draftTitle.value.trim().length > 0)

const currentParentId = computed(() => {
  const last = pathStack.value[pathStack.value.length - 1]
  return last?.id ?? 0
})

const currentFolderId = computed(() => pathStack.value[pathStack.value.length - 1]?.id ?? null)

const folderMenuParentId = computed(() => {
  if (pathStack.value.length <= 1) return 0
  return pathStack.value[pathStack.value.length - 2]?.id ?? 0
})

const breadcrumbs = computed(() => [
  { id: null, label: '沉淀' },
  ...pathStack.value.map((item) => ({ id: item.id, label: item.name })),
])

const resetDraft = () => {
  draftTitle.value = ''
  draftContent.value = ''
  insertedFragmentIds.value = new Set()
}

const closeFolderMenu = () => {
  folderMenuOpen.value = false
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
    const list = await fetchFolderList(folderMenuParentId.value)
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

const enterFolderFromMenu = (folder) => {
  if (folder.type !== 'folder') return
  if (pathStack.value.length) {
    pathStack.value = [
      ...pathStack.value.slice(0, -1),
      { id: folder.id, name: folder.name },
    ]
  } else {
    pathStack.value = [{ id: folder.id, name: folder.name }]
  }
  closeFolderMenu()
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
  nextTick(() => contentTextareaRef.value?.focus())
}

const onKeydown = (event) => {
  if (!props.visible || props.saving) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (folderMenuOpen.value) {
      closeFolderMenu()
      return
    }
    emitClose()
  }
}

const onDocumentPointerdown = (event) => {
  if (!folderMenuOpen.value) return
  if (currentCrumbRef.value?.contains(event.target)) return
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

.breadcrumb-folder-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.breadcrumb-folder-toggle:hover,
.breadcrumb-folder-toggle.is-open {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
}

.breadcrumb-folder-toggle.is-open svg {
  transform: rotate(180deg);
}

.breadcrumb-folder-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 5;
  min-width: 180px;
  max-width: min(280px, 70vw);
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
}

.breadcrumb-folder-state {
  margin: 0;
  padding: 8px 10px;
  color: var(--color-secondary-text);
  font-size: 13px;
}

.breadcrumb-folder-option {
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

.breadcrumb-folder-option:hover {
  background: rgba(24, 24, 27, 0.05);
}

.breadcrumb-folder-option.is-active {
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-accent);
}

.breadcrumb-folder-option span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb-sep {
  color: #a1a1aa;
  font-size: 12px;
  user-select: none;
}

.struct-note-modal-save {
  justify-self: end;
}

.struct-note-modal-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0;
  padding: 16px 18px 32px;
  box-sizing: border-box;
}

.struct-note-modal-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 24px 24px 0;
  box-sizing: border-box;
}

.struct-note-fragments {
  flex: 0 0 300px;
  width: 300px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border);
  padding: 24px 0 0 20px;
  box-sizing: border-box;
}

.struct-note-fragments-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-secondary-text);
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
  border: 0;
  border-radius: 8px;
  padding: 6px 10px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.struct-note-fragment-add:disabled {
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
  margin-bottom: 20px;
  caret-color: var(--color-accent);
}

.struct-note-title-input::placeholder {
  color: #d1d5db;
}

.struct-note-content-textarea {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text);
  resize: none;
  padding: 0;
  caret-color: var(--color-accent);
}

.struct-note-content-textarea::placeholder {
  color: #d1d5db;
}

@media (max-width: 900px) {
  .struct-note-modal-layout {
    flex-direction: column;
  }

  .struct-note-fragments {
    flex: 0 0 auto;
    width: 100%;
    max-height: 220px;
    border-left: 0;
    border-top: 1px solid var(--color-border);
    padding: 16px 0 0;
  }

  .struct-note-modal-body {
    padding-top: 12px;
  }
}
</style>
