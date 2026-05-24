<template>
  <section class="sediment-panel">
    <header class="sediment-header">
      <nav class="sediment-breadcrumb" aria-label="面包屑">
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
              :class="{ 'breadcrumb-link--drag-over': crumbDragOver === index }"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="navigateToCrumb(index)"
              @dragover.prevent="onCrumbDragOver(index)"
              @dragleave="onCrumbDragLeave(index)"
              @drop.prevent="onDropToCrumb(crumb)"
            >
              {{ crumb.label }}
            </motion.button>
            <span v-else class="breadcrumb-current" aria-current="page">
              {{ crumb.label }}
            </span>
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

      <AppButton
        class="btn btn-primary sediment-create-file"
        title="新建文件"
        @click="openCreateNoteModal"
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
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </AppButton>
    </header>

    <p v-if="loading" class="sediment-state">加载中…</p>

    <motion.div v-else class="folder-grid-wrap">
      <ul class="folder-grid" role="list">
        <li
          v-for="item in folderItems"
          :key="`folder-${item.id}`"
          class="folder-grid-item"
          :class="{ 'is-dragging-source': draggingItem?.id === item.id }"
          draggable="true"
          @dragstart="onDragStart(item, $event)"
          @dragend="onDragEnd"
        >
          <!-- 重命名态 -->
          <div v-if="renamingId === item.id" class="folder-create-form">
            <span class="folder-icon-wrap" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
              </svg>
            </span>
            <input
              v-model="draftRename"
              class="folder-name-input"
              type="text"
              maxlength="20"
              spellcheck="false"
              :disabled="renameSaving"
              @keydown.enter.prevent="confirmRename(item)"
              @keydown.esc.prevent="cancelRename"
              @blur="cancelRename"
            />
          </div>

          <!-- 删除确认态 -->
          <div v-else-if="deletingId === item.id" class="folder-create-form">
            <span class="folder-icon-wrap folder-icon-wrap--danger" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </span>
            <div class="folder-delete-row">
              <button class="folder-delete-yes" :disabled="deleteSaving" @click="confirmDelete(item)">删除</button>
              <button class="folder-delete-no" @click="deletingId = null">取消</button>
            </div>
          </div>

          <!-- 正常态 -->
          <div v-else class="folder-item-wrap">
            <button
              type="button"
              class="folder-card"
              :class="{ 'folder-card--drop-over': dropTargetId === item.id }"
              :title="item.name"
              @click="!isDragging && enterFolder(item)"
              @dragover.prevent="onFolderDragOver(item, $event)"
              @dragleave="onFolderDragLeave(item, $event)"
              @drop.prevent="onDropToFolder(item)"
            >
              <span class="folder-icon-wrap" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                </svg>
              </span>
              <span class="folder-name">{{ item.name }}</span>
            </button>
            <div class="card-actions" @click.stop @mousedown.stop>
              <button class="card-action-btn" title="重命名" @click="startRename(item)">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
              <button class="card-action-btn card-action-btn--danger" title="删除" @click="startDelete(item)">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
              </button>
            </div>
          </div>
        </li>

        <li
          v-for="item in noteItems"
          :key="`note-${item.id}`"
          class="folder-grid-item"
          :class="{ 'is-dragging-source': draggingItem?.id === item.id }"
          draggable="true"
          @dragstart="onDragStart(item, $event)"
          @dragend="onDragEnd"
        >
          <!-- 重命名态 -->
          <div v-if="renamingId === item.id" class="folder-create-form">
            <span class="folder-icon-wrap folder-icon-wrap--note" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <input
              v-model="draftRename"
              class="folder-name-input"
              type="text"
              maxlength="80"
              spellcheck="false"
              :disabled="renameSaving"
              @keydown.enter.prevent="confirmRename(item)"
              @keydown.esc.prevent="cancelRename"
              @blur="cancelRename"
            />
          </div>

          <!-- 删除确认态 -->
          <div v-else-if="deletingId === item.id" class="folder-create-form">
            <span class="folder-icon-wrap folder-icon-wrap--danger" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </span>
            <div class="folder-delete-row">
              <button class="folder-delete-yes" :disabled="deleteSaving" @click="confirmDelete(item)">删除</button>
              <button class="folder-delete-no" @click="deletingId = null">取消</button>
            </div>
          </div>

          <!-- 正常态 -->
          <div v-else class="folder-item-wrap">
            <motion.button
              type="button"
              class="folder-card folder-card--note"
              :title="item.name"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="openNoteView(item)"
            >
              <span class="folder-icon-wrap folder-icon-wrap--note" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span class="folder-name">{{ item.name }}</span>
            </motion.button>
            <div class="card-actions" @click.stop @mousedown.stop>
              <button class="card-action-btn" title="重命名" @click="startRename(item)">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
              <button class="card-action-btn card-action-btn--danger" title="删除" @click="startDelete(item)">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
              </button>
            </div>
          </div>
        </li>

        <li class="folder-grid-item">
          <AnimatePresence mode="wait">
            <motion.div
              v-if="creatingFolder"
              key="folder-create-form"
              class="folder-create-form"
              role="group"
              aria-label="新建文件夹"
              :initial="{ opacity: 0, scale: 0.86, y: 8 }"
              :animate="{ opacity: 1, scale: 1, y: 0 }"
              :exit="{ opacity: 0, scale: 0.86, y: 8 }"
              :transition="{ duration: 0.2, ease: 'easeOut' }"
            >
              <span class="folder-icon-wrap folder-icon-wrap--draft" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="34"
                  height="34"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"
                  />
                </svg>
              </span>
              <input
                ref="folderNameInputRef"
                v-model="draftFolderName"
                class="folder-name-input"
                type="text"
                maxlength="20"
                placeholder="文件夹名称"
                spellcheck="false"
                :disabled="folderSaving"
                @keydown.esc.prevent="cancelCreateFolder"
                @keydown.enter.prevent="confirmCreateFolder"
                @blur="onFolderInputBlur"
              />
            </motion.div>

            <motion.button
              v-else
              key="folder-create-btn"
              type="button"
              class="folder-create"
              title="新建文件夹"
              :disabled="folderSaving"
              :initial="{ opacity: 0, scale: 0.86 }"
              :animate="{ opacity: 1, scale: 1 }"
              :exit="{ opacity: 0, scale: 0.86 }"
              :transition="{ duration: 0.2, ease: 'easeOut' }"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              @click="startCreateFolder"
            >
              <span class="folder-create-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"
                  />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </span>
              <span class="folder-create-label">新建文件夹</span>
            </motion.button>
          </AnimatePresence>
        </li>
      </ul>
    </motion.div>

    <StructNoteCreateModal
      :visible="createNoteVisible"
      :saving="noteSaving"
      @close="closeCreateNoteModal"
      @save="handleCreateNote"
    />

    <StructNoteViewModal
      :visible="noteViewVisible"
      :note-item="activeNoteItem"
      @close="closeNoteView"
      @saved="loadCurrentList"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import {
  createNoteInFolder,
  createStructFolder,
  deleteStructItem,
  fetchFolderList,
  moveStructItem,
  renameStructItem,
} from '../../api/structFolder'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'
import StructNoteCreateModal from './StructNoteCreateModal.vue'
import StructNoteViewModal from './StructNoteViewModal.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['error'])

const { presets } = useMotionPresets()

const items = ref([])
const pathStack = ref([])
const loading = ref(false)
const folderSaving = ref(false)
const creatingFolder = ref(false)
const draftFolderName = ref('')
const folderNameInputRef = ref(null)

const createNoteVisible = ref(false)
const noteSaving = ref(false)

// 文件预览
const noteViewVisible = ref(false)
const activeNoteItem = ref(null)

// 拖拽状态
const draggingItem = ref(null)
const dropTargetId = ref(null)
const isDragging = ref(false)
const crumbDragOver = ref(-1)

// 重命名
const renamingId = ref(null)
const draftRename = ref('')
const renameSaving = ref(false)

// 删除
const deletingId = ref(null)
const deleteSaving = ref(false)

let loadToken = 0

const currentParentId = computed(() =>
  pathStack.value.length
    ? pathStack.value[pathStack.value.length - 1].id
    : 0,
)

const breadcrumbs = computed(() => [
  { id: null, label: '沉淀' },
  ...pathStack.value.map((item) => ({ id: item.id, label: item.name })),
])

const folderItems = computed(() =>
  items.value.filter((item) => item.type === 'folder'),
)

const noteItems = computed(() =>
  items.value.filter((item) => item.type === 'note'),
)

const loadCurrentList = async () => {
  const token = ++loadToken
  loading.value = true
  try {
    const list = await fetchFolderList(currentParentId.value)
    if (token !== loadToken) return
    items.value = list
  } catch (error) {
    if (token !== loadToken) return
    items.value = []
    emit('error', error)
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
}

const enterFolder = (folder) => {
  if (folder.type !== 'folder') return
  pathStack.value.push({ id: folder.id, name: folder.name })
  loadCurrentList()
}

const navigateToCrumb = (index) => {
  pathStack.value = pathStack.value.slice(0, index)
  loadCurrentList()
}

const startCreateFolder = async () => {
  creatingFolder.value = true
  draftFolderName.value = ''
  await nextTick()
  folderNameInputRef.value?.focus()
}

const cancelCreateFolder = () => {
  if (folderSaving.value) return
  creatingFolder.value = false
  draftFolderName.value = ''
}

const confirmCreateFolder = async () => {
  const name = draftFolderName.value.trim()
  if (!name || folderSaving.value) {
    cancelCreateFolder()
    return
  }

  folderSaving.value = true
  try {
    await createStructFolder({
      parentId: currentParentId.value,
      name,
    })
    creatingFolder.value = false
    draftFolderName.value = ''
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  } finally {
    folderSaving.value = false
  }
}

const onFolderInputBlur = () => {
  cancelCreateFolder()
}

// ---- 文件预览 ----
const openNoteView = (item) => {
  activeNoteItem.value = item
  noteViewVisible.value = true
}

const closeNoteView = () => {
  noteViewVisible.value = false
  activeNoteItem.value = null
}

// ---- 重命名 ----
const startRename = async (item) => {
  deletingId.value = null
  renamingId.value = item.id
  draftRename.value = item.name
  await nextTick()
  document.querySelector('.folder-name-input')?.focus()
  document.querySelector('.folder-name-input')?.select()
}

const cancelRename = () => {
  if (renameSaving.value) return
  renamingId.value = null
  draftRename.value = ''
}

const confirmRename = async (item) => {
  const name = draftRename.value.trim()
  if (!name || renameSaving.value || name === item.name) {
    cancelRename()
    return
  }
  renameSaving.value = true
  try {
    await renameStructItem({ id: item.id, name })
    renamingId.value = null
    draftRename.value = ''
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  } finally {
    renameSaving.value = false
  }
}

// ---- 删除 ----
const startDelete = (item) => {
  renamingId.value = null
  deletingId.value = item.id
}

const confirmDelete = async (item) => {
  if (deleteSaving.value) return
  deleteSaving.value = true
  try {
    await deleteStructItem(item.id)
    deletingId.value = null
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  } finally {
    deleteSaving.value = false
  }
}

// ---- 拖拽 ----
const onDragStart = (item, event) => {
  draggingItem.value = item
  isDragging.value = true
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(item.id))
  // 仅用图标作为拖拽 ghost，去掉白色方块背景
  const iconEl = event.currentTarget.querySelector('.folder-icon-wrap')
  if (iconEl) {
    event.dataTransfer.setDragImage(iconEl, iconEl.offsetWidth / 2, iconEl.offsetHeight / 2)
  }
}

const onDragEnd = () => {
  draggingItem.value = null
  dropTargetId.value = null
  crumbDragOver.value = -1
  isDragging.value = false
}

// ---- 面包屑拖放（拖出文件夹）----
const onCrumbDragOver = (index) => {
  if (!draggingItem.value) return
  crumbDragOver.value = index
}

const onCrumbDragLeave = (index) => {
  if (crumbDragOver.value === index) crumbDragOver.value = -1
}

const onDropToCrumb = async (crumb) => {
  const item = draggingItem.value
  crumbDragOver.value = -1
  draggingItem.value = null
  dropTargetId.value = null
  isDragging.value = false
  if (!item) return
  const targetParentId = crumb.id ?? 0
  try {
    await moveStructItem({ id: item.id, targetParentId })
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  }
}

const onFolderDragOver = (folder, event) => {
  const dragging = draggingItem.value
  if (!dragging || dragging.id === folder.id) return
  event.dataTransfer.dropEffect = 'move'
  dropTargetId.value = folder.id
}

const onFolderDragLeave = (folder, event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    if (dropTargetId.value === folder.id) dropTargetId.value = null
  }
}

const onDropToFolder = async (folder) => {
  const item = draggingItem.value
  draggingItem.value = null
  dropTargetId.value = null
  isDragging.value = false
  if (!item || item.id === folder.id) return
  try {
    await moveStructItem({ id: item.id, targetParentId: folder.id })
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  }
}

// ---- 新建文件 ----
const openCreateNoteModal = () => {
  createNoteVisible.value = true
}

const closeCreateNoteModal = () => {
  if (noteSaving.value) return
  createNoteVisible.value = false
}

const handleCreateNote = async ({ title, content }) => {
  if (noteSaving.value) return
  noteSaving.value = true
  try {
    await createNoteInFolder({
      parentId: currentParentId.value,
      title,
      content,
    })
    createNoteVisible.value = false
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  } finally {
    noteSaving.value = false
  }
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) loadCurrentList()
  },
  { immediate: true },
)
</script>

<style scoped>
.sediment-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: var(--frame-inner-width);
  padding-top: 22px;
}

.sediment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 24px;
  flex: 0 0 auto;
}

.sediment-state {
  margin: 48px 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
}

.sediment-breadcrumb {
  min-width: 0;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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

.breadcrumb-link--drag-over {
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-accent);
}

.breadcrumb-current {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.breadcrumb-sep {
  color: #a1a1aa;
  font-size: 12px;
  user-select: none;
}

.sediment-create-file {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
}

.folder-grid-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 28px;
  scrollbar-width: thin;
  scrollbar-color: rgba(24, 24, 27, 0.18) transparent;
}

.folder-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 18px 22px;
  margin: 0;
  padding: 8px 0 0;
  list-style: none;
}

.folder-grid-item {
  flex: 0 0 auto;
}

.folder-card,
.folder-create,
.folder-create-form {
  width: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.folder-card {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: center;
}

.folder-card--note {
  cursor: pointer;
}

/* 拖放目标文件夹高亮 - 柔和版 */
.folder-card--drop-over .folder-icon-wrap {
  background: rgba(37, 99, 235, 0.05);
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

/* 正在被拖动的源元素 */
.is-dragging-source > * {
  opacity: 0.35;
  pointer-events: none;
}

.folder-grid-item[draggable='true'] {
  cursor: grab;
}

.folder-grid-item[draggable='true']:active {
  cursor: grabbing;
}

/* hover 操作按钮容器 */
.folder-item-wrap {
  position: relative;
  width: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.card-actions {
  position: absolute;
  top: -5px;
  right: -5px;
  display: flex;
  gap: 3px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.14s ease;
  z-index: 1;
}

.folder-item-wrap:hover .card-actions {
  opacity: 1;
  pointer-events: auto;
}

.card-action-btn {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.13);
  color: var(--color-secondary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: background 0.1s, color 0.1s;
}

.card-action-btn:hover {
  background: #fff;
  color: var(--color-primary);
}

.card-action-btn--danger:hover {
  color: #ef4444;
}

/* 删除确认行 */
.folder-delete-row {
  display: flex;
  gap: 4px;
  width: 100%;
}

.folder-delete-yes,
.folder-delete-no {
  flex: 1;
  height: 26px;
  border-radius: 7px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 0;
}

.folder-delete-yes {
  background: #fef2f2;
  color: #ef4444;
}

.folder-delete-yes:hover {
  background: #fee2e2;
}

.folder-delete-no {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
}

.folder-delete-no:hover {
  background: rgba(24, 24, 27, 0.1);
}

/* 文件夹图标 - 危险态（删除确认） */
.folder-icon-wrap--danger {
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.15);
  box-shadow: none;
}

.folder-card:hover .folder-icon-wrap {
  box-shadow: 0 6px 18px rgba(24, 24, 27, 0.1);
  border-color: rgba(37, 99, 235, 0.12);
}

.folder-card--note:hover .folder-icon-wrap {
  box-shadow: var(--shadow-card);
  border-color: rgba(24, 24, 27, 0.06);
}

.folder-card:focus-visible {
  outline: none;
}

.folder-card:focus-visible .folder-icon-wrap {
  box-shadow: var(--focus-ring), var(--shadow-card);
}

.folder-icon-wrap {
  width: 72px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  border: 1px solid rgba(24, 24, 27, 0.06);
  background: #ffffff;
  color: #ca8a04;
  box-shadow: var(--shadow-card);
}

.folder-icon-wrap--note {
  color: var(--color-accent);
}

.folder-icon-wrap--draft {
  color: #a1a1aa;
  border-style: dashed;
  border-color: var(--btn-dashed-border);
  box-shadow: none;
}

.folder-name {
  width: 100%;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-create {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.folder-create-icon {
  width: 72px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  border: 1.5px dashed var(--btn-dashed-border);
  background: rgba(255, 255, 255, 0.55);
  color: var(--color-secondary-text);
}

.folder-create:hover .folder-create-icon {
  border-color: var(--btn-dashed-border-hover);
  background: var(--btn-dashed-bg-hover);
  color: var(--color-primary);
}

.folder-create:focus-visible {
  outline: none;
}

.folder-create:focus-visible .folder-create-icon {
  border-color: var(--btn-dashed-border-focus);
  box-shadow: var(--focus-ring);
}

.folder-create-label {
  width: 100%;
  color: var(--color-secondary-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.folder-create-form {
  align-items: center;
}

.folder-name-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-text);
  font-family: inherit;
  font-size: 12px;
  text-align: center;
  outline: none;
}

.folder-name-input:focus {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.folder-name-input::placeholder {
  color: #a1a1aa;
}

@media (max-width: 720px) {
  .sediment-panel {
    padding-top: 16px;
  }

  .sediment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 18px;
  }

  .sediment-create-file {
    align-self: flex-end;
  }

  .folder-grid {
    gap: 14px 16px;
  }
}
</style>
