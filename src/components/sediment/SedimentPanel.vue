<template>
  <section class="sediment-panel">
    <header class="sediment-header">
      <div class="sediment-header-text">
        <h2 class="sediment-title">沉淀</h2>
        <p class="sediment-desc">把碎片整理成结构化长文，按文件夹沉淀</p>
      </div>
      <div class="sediment-header-actions">
        <AppButton
          class="btn btn-primary sediment-create-file"
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
          <span>新建文件</span>
        </AppButton>
      </div>
    </header>

    <nav class="sediment-breadcrumb" aria-label="当前位置">
      <ol class="breadcrumb-list">
        <li class="breadcrumb-root" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
          </svg>
        </li>
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
      <button
        v-if="currentTodoProjectId"
        type="button"
        class="breadcrumb-goto-todo"
        title="打开关联待办"
        @click="openTodoProjectById(currentTodoProjectId)"
      >
        去待办
      </button>
    </nav>

    <p v-if="loading" class="sediment-state">加载中…</p>

    <motion.div v-else class="folder-grid-wrap" @contextmenu.prevent>
      <div class="folder-grid" role="list">
        <VueDraggable
          v-model="items"
          tag="ul"
          class="folder-grid-sortable"
          :animation="180"
          :disabled="sortDisabled"
          handle=".folder-sort-handle"
          filter=".card-move-handle, .card-action-btn, .folder-name-input"
          :prevent-on-filter="false"
          ghost-class="folder-sort-ghost"
          chosen-class="folder-sort-chosen"
          drag-class="folder-sort-drag"
          @start="onSortDragStart"
          @end="onSortDragEnd"
        >
          <li
            v-for="item in items"
            :key="getItemKey(item)"
            class="folder-grid-item"
            :class="{
              'is-dragging-source':
                sortDraggingId === item.id || moveDraggingItem?.id === item.id,
            }"
          >
          <!-- 重命名态 -->
          <div
            v-if="renamingId === item.id"
            class="folder-create-form"
            @dragstart.stop
          >
            <span
              class="folder-icon-wrap"
              :class="{ 'folder-icon-wrap--note': item.type === 'note' }"
              aria-hidden="true"
            >
              <svg
                v-if="item.type === 'folder'"
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
              <svg
                v-else
                viewBox="0 0 24 24"
                width="34"
                height="34"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <input
              v-model="draftRename"
              class="folder-name-input"
              type="text"
              :maxlength="item.type === 'folder' ? 20 : 80"
              spellcheck="false"
              :disabled="renameSaving"
              @keydown.enter.prevent="confirmRename(item)"
              @keydown.esc.prevent="cancelRename"
              @blur="cancelRename"
            />
          </div>

          <!-- 删除确认态 -->
          <div
            v-else-if="deletingId === item.id"
            class="folder-create-form"
            @dragstart.stop
          >
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
          <div
            v-else
            class="folder-item-wrap"
            :class="{ 'is-action-menu-open': actionMenuItemId === item.id }"
            @contextmenu.prevent="openActionMenu(item)"
          >
            <div
              class="folder-card"
              :class="{
                'folder-card--note': item.type === 'note',
                'folder-card--drop-over':
                  item.type === 'folder' && dropTargetId === item.id,
              }"
              @dragover.prevent.stop="onItemFolderDragOver(item, $event)"
              @dragleave="onItemFolderDragLeave(item, $event)"
              @drop.prevent.stop="onItemFolderDrop(item)"
            >
              <motion.button
                type="button"
                class="folder-card-hit folder-sort-handle"
                :title="actionMenuItemId === item.id ? undefined : item.name"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="onCardClick(item)"
              >
                <span
                  class="folder-icon-wrap"
                  :class="{
                    'folder-icon-wrap--note': item.type === 'note',
                    'folder-icon-wrap--todo': isTodoLinkedFolder(item),
                  }"
                  aria-hidden="true"
                >
                  <svg
                    v-if="item.type === 'folder'"
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
                  <svg
                    v-else
                    viewBox="0 0 24 24"
                    width="34"
                    height="34"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span v-if="isTodoLinkedFolder(item)" class="folder-todo-badge">待办</span>
                </span>
              </motion.button>
              <AnimatePresence mode="wait">
                <motion.div
                  v-if="actionMenuItemId !== item.id"
                  key="meta"
                  class="folder-card-meta"
                  :initial="presets.swapLabel.initial"
                  :animate="presets.swapLabel.animate"
                  :exit="presets.swapLabel.exit"
                  :transition="presets.swapLabel.transition"
                >
                  <span
                    class="folder-name"
                    :class="{ 'folder-name--todo': isTodoLinkedFolder(item) }"
                    :title="item.name"
                  >
                    {{ item.name }}
                  </span>
                </motion.div>
                <motion.div
                  v-else
                  key="actions"
                  class="card-actions"
                  role="toolbar"
                  aria-label="项目操作"
                  :initial="actionToolbarMotion.initial"
                  :animate="actionToolbarMotion.animate"
                  :exit="actionToolbarMotion.exit"
                  :transition="actionToolbarMotion.transition"
                  @click.stop
                  @mousedown.stop
                  @pointerdown.stop
                  @dragstart.stop
                  @contextmenu.stop
                >
                  <button
                    type="button"
                    class="card-action-btn card-move-handle"
                    title="移动到…"
                    draggable="true"
                    @dragstart.stop="onMoveDragStart(item, $event)"
                    @dragend="onMoveDragEnd"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 9h14" />
                      <path d="M5 15h14" />
                      <path d="M9 5v14" />
                      <path d="M15 5v14" />
                    </svg>
                  </button>
                  <motion.button
                    type="button"
                    class="card-action-btn"
                    title="重命名"
                    :while-hover="presets.button.hover"
                    :while-tap="presets.button.tap"
                    :transition="presets.button.transition"
                    @click="startRename(item)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </motion.button>
                  <motion.button
                    type="button"
                    class="card-action-btn card-action-btn--danger"
                    title="删除"
                    :while-hover="presets.button.hover"
                    :while-tap="presets.button.tap"
                    :transition="presets.button.transition"
                    @click="startDelete(item)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </motion.button>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          </li>
        </VueDraggable>

        <ul class="folder-grid-static">
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
              :class="{ 'is-disabled': !canCreateFolder }"
              :title="canCreateFolder ? '新建文件夹' : '最多支持两级文件夹嵌套'"
              :disabled="folderSaving || !canCreateFolder"
              :initial="{ opacity: 0, scale: 0.86 }"
              :animate="{ opacity: 1, scale: 1 }"
              :exit="{ opacity: 0, scale: 0.86 }"
              :transition="{ duration: 0.2, ease: 'easeOut' }"
              :while-hover="canCreateFolder ? presets.button.hover : undefined"
              :while-tap="canCreateFolder ? presets.button.tap : undefined"
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
      </div>
    </motion.div>

    <StructNoteCreateModal
      :visible="createNoteVisible"
      :saving="noteSaving"
      :initial-path-stack="createNoteInitialPathStack"
      :fragment-notes="pendingFragmentNotes"
      @close="closeCreateNoteModal"
      @save="handleCreateNote"
      @ai-unavailable="handleAiUnavailable"
      @error="(error) => emit('error', error)"
    />

    <StructNoteViewModal
      :visible="noteViewVisible"
      :note-item="activeNoteItem"
      :initial-path-stack="pathStack"
      @close="closeNoteView"
      @saved="loadCurrentList"
      @fragment-restored="(note) => emit('fragment-restored', note)"
      @fragments-archived="(ids) => emit('fragments-archived', ids)"
      @error="(error) => emit('error', error)"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { VueDraggable } from 'vue-draggable-plus'
import {
  createNoteInFolder,
  createStructFolder,
  deleteStructItem,
  fetchFolderList,
  fetchFolderPathStack,
  moveStructItem,
  renameStructItem,
  updateStructSort,
} from '../../api/structFolder'
import { fetchProjects } from '../../api/project'
import { archiveFragmentNotes } from '../../api/note'
import { findStructFolderItemByNoteId, updateStructNote } from '../../api/structNote'
import {
  finalizeInlineImagesInMarkdown,
  hasPendingInlineImages,
} from '../../utils/attachmentMarkdown'
import { loadStructFolderPrefs, saveStructFolderPrefs } from '../../storage/utools/structFolderPrefs'
import { requestUtoolsDetachIfNeeded } from '../../composables/useUtoolsWindow'
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

const emit = defineEmits([
  'error',
  'fragments-archived',
  'fragment-restored',
  'moved-to-recycle',
  'open-todo-project',
])

const { presets } = useMotionPresets()

const actionToolbarMotion = {
  initial: { opacity: 0, y: 6, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.97 },
  transition: { duration: 0.18, ease: 'easeOut' },
}

/** 根目录为 0；最多两级嵌套 → pathStack.length < 2 才可新建 */
const MAX_FOLDER_DEPTH = 2

const items = ref([])
const pathStack = ref([])
const loading = ref(false)
const folderSaving = ref(false)
const creatingFolder = ref(false)
const draftFolderName = ref('')
const folderNameInputRef = ref(null)
/** 事情关联的沉淀文件夹 id，用于末尾排序与「待办」标识 */
const todoFolderIdSet = ref(new Set())
/** folderId → projectId，供「去待办」跳转 */
const todoFolderProjectMap = ref(new Map())

const canCreateFolder = computed(() => pathStack.value.length < MAX_FOLDER_DEPTH)

const currentTodoProjectId = computed(() => {
  const folderId = String(currentParentId.value || '').trim()
  if (!folderId || folderId === '0') return ''
  return todoFolderProjectMap.value.get(folderId) || ''
})

const createNoteVisible = ref(false)
const createNoteInitialPathStack = ref([])
const noteSaving = ref(false)
const pendingFragmentNotes = ref([])

// 文件预览
const noteViewVisible = ref(false)
const activeNoteItem = ref(null)

// 拖拽：卡片排序（Sortable）+ 手柄移动（原生）
const moveDraggingItem = ref(null)
const sortDraggingId = ref(null)
const sortSaving = ref(false)
const dropTargetId = ref(null)
const isMoveDragging = ref(false)
const crumbDragOver = ref(-1)

// 重命名
const renamingId = ref(null)
const draftRename = ref('')
const renameSaving = ref(false)

// 删除
const deletingId = ref(null)
const deleteSaving = ref(false)

// 右键操作菜单（同时仅一项）
const actionMenuItemId = ref(null)

let loadToken = 0

const currentParentId = computed(() =>
  pathStack.value.length
    ? pathStack.value[pathStack.value.length - 1].id
    : 0,
)

const breadcrumbs = computed(() => [
  { id: null, label: '全部' },
  ...pathStack.value.map((item) => ({ id: item.id, label: item.name })),
])

const sortDisabled = computed(
  () =>
    sortSaving.value ||
    renamingId.value != null ||
    deletingId.value != null ||
    creatingFolder.value ||
    actionMenuItemId.value != null,
)

const closeActionMenu = () => {
  actionMenuItemId.value = null
}

const openActionMenu = (item) => {
  if (renamingId.value != null || deletingId.value != null) return
  actionMenuItemId.value = item.id
}

const onCardClick = (item) => {
  if (actionMenuItemId.value === item.id) {
    closeActionMenu()
    return
  }
  if (isMoveDragging.value) return
  if (item.type === 'folder') {
    enterFolder(item)
  } else {
    openNoteView(item)
  }
}

const onDocumentKeydown = (event) => {
  if (event.key !== 'Escape') return
  closeActionMenu()
}

const onDocumentPointerdown = (event) => {
  if (actionMenuItemId.value == null) return
  if (isMoveDragging.value) return
  if (event.target.closest('.folder-item-wrap.is-action-menu-open')) return
  closeActionMenu()
}

const getItemKey = (item) =>
  item.type === 'folder' ? `folder-${item.id}` : `note-${item.id}`

const buildNamedDragGhost = (item) => {
  const ghost = document.createElement('div')
  ghost.className = 'sediment-drag-ghost'
  const isNote = item.type === 'note'
  ghost.innerHTML = `
    <span class="sediment-drag-ghost-icon ${isNote ? 'is-note' : ''}">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        ${
          isNote
            ? '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
            : '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>'
        }
      </svg>
    </span>
    <span class="sediment-drag-ghost-name"></span>
  `
  ghost.querySelector('.sediment-drag-ghost-name').textContent = item.name || ''
  document.body.appendChild(ghost)
  return ghost
}

const setNamedDragImage = (event, item) => {
  const ghost = buildNamedDragGhost(item)
  event.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2)
  requestAnimationFrame(() => ghost.remove())
}

const isTodoLinkedFolder = (item) =>
  item?.type === 'folder' && todoFolderIdSet.value.has(String(item.id))

/** 根目录下：待办关联文件夹固定排到末尾，避免插队挡住常用文件夹 */
const partitionTodoFoldersLast = (list) => {
  if (!Array.isArray(list) || !list.length || !todoFolderIdSet.value.size) return list || []
  const rest = []
  const todoLinked = []
  for (const item of list) {
    if (isTodoLinkedFolder(item)) todoLinked.push(item)
    else rest.push(item)
  }
  return [...rest, ...todoLinked]
}

const refreshTodoFolderIds = async () => {
  try {
    const projects = await fetchProjects({ includeArchived: true })
    const next = new Set()
    const map = new Map()
    for (const project of projects || []) {
      const folderId = String(project?.sedimentFolderId || '').trim()
      const projectId = String(project?.id || '').trim()
      if (!folderId || !projectId) continue
      next.add(folderId)
      map.set(folderId, projectId)
    }
    todoFolderIdSet.value = next
    todoFolderProjectMap.value = map
  } catch {
    todoFolderIdSet.value = new Set()
    todoFolderProjectMap.value = new Map()
  }
}

const openTodoProjectById = (projectId) => {
  const id = String(projectId || '').trim()
  if (!id) {
    emit('error', new Error('未找到关联的待办事情'))
    return
  }
  emit('open-todo-project', { projectId: id })
}

const loadCurrentList = async () => {
  const token = ++loadToken
  loading.value = true
  try {
    await refreshTodoFolderIds()
    if (token !== loadToken) return
    const list = await fetchFolderList(currentParentId.value)
    if (token !== loadToken) return
    const isRoot = !currentParentId.value || currentParentId.value === 0
    items.value = isRoot ? partitionTodoFoldersLast(list) : list
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
  if (pathStack.value.length >= MAX_FOLDER_DEPTH) return
  pathStack.value.push({ id: folder.id, name: folder.name })
  loadCurrentList()
}

const openFolderById = async (folderId) => {
  const id = String(folderId || '').trim()
  if (!id) {
    pathStack.value = []
    await loadCurrentList()
    return
  }
  try {
    const stack = await fetchFolderPathStack(id)
    pathStack.value = Array.isArray(stack)
      ? stack.map((item) => ({ id: item.id, name: item.name }))
      : []
  } catch {
    pathStack.value = []
  }
  await loadCurrentList()
}

const navigateToCrumb = (index) => {
  pathStack.value = pathStack.value.slice(0, index)
  loadCurrentList()
}

const focusFolderNameInput = async () => {
  await nextTick()
  requestAnimationFrame(() => {
    folderNameInputRef.value?.focus()
    folderNameInputRef.value?.select()
  })
}

const startCreateFolder = async () => {
  if (!canCreateFolder.value) return
  creatingFolder.value = true
  draftFolderName.value = ''
  await focusFolderNameInput()
}

watch(creatingFolder, async (open) => {
  if (open) await focusFolderNameInput()
})

const cancelCreateFolder = () => {
  if (folderSaving.value) return
  creatingFolder.value = false
  draftFolderName.value = ''
}

const confirmCreateFolder = async () => {
  const name = draftFolderName.value.trim()
  if (!name || folderSaving.value || !canCreateFolder.value) {
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

const openNoteViewByNoteId = async (noteId, title = '') => {
  const folderItem = await findStructFolderItemByNoteId(noteId)
  openNoteView(
    folderItem || {
      type: 'note',
      id: noteId,
      noteId,
      name: title || '无标题',
    },
  )
}

const closeNoteView = () => {
  noteViewVisible.value = false
  activeNoteItem.value = null
}

const dismissOverlays = () => {
  if (noteViewVisible.value) closeNoteView()
  if (createNoteVisible.value) closeCreateNoteModal()
}

// ---- 重命名 ----
const startRename = async (item) => {
  closeActionMenu()
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
  closeActionMenu()
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
    emit('moved-to-recycle', { recycleType: 'sediment', id: item.noteId || item.id })
  } catch (error) {
    emit('error', error)
  } finally {
    deleteSaving.value = false
  }
}

// ---- 排序拖拽（拖卡片）----
const onSortDragStart = (evt) => {
  closeActionMenu()
  const item = items.value[evt.oldIndex]
  sortDraggingId.value = item?.id ?? null
}

const onSortDragEnd = async (evt) => {
  sortDraggingId.value = null
  if (evt.oldIndex === evt.newIndex || evt.oldIndex == null || evt.newIndex == null) {
    return
  }

  const list = items.value.map((item, index) => ({
    id: item.id,
    sort: index,
  }))

  sortSaving.value = true
  try {
    await updateStructSort(list)
  } catch (error) {
    emit('error', error)
    await loadCurrentList()
  } finally {
    sortSaving.value = false
  }
}

// ---- 移动拖拽（拖手柄 → 文件夹/面包屑）----
const onMoveDragStart = (item, event) => {
  moveDraggingItem.value = item
  isMoveDragging.value = true
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(item.id))
  setNamedDragImage(event, item)
}

const onMoveDragEnd = () => {
  moveDraggingItem.value = null
  dropTargetId.value = null
  crumbDragOver.value = -1
  isMoveDragging.value = false
}

// ---- 面包屑拖放（拖出文件夹）----
const onCrumbDragOver = (index) => {
  if (!moveDraggingItem.value) return
  crumbDragOver.value = index
}

const onCrumbDragLeave = (index) => {
  if (crumbDragOver.value === index) crumbDragOver.value = -1
}

const onDropToCrumb = async (crumb) => {
  const item = moveDraggingItem.value
  onMoveDragEnd()
  if (!item) return
  const targetParentId = crumb.id ?? 0
  try {
    await moveStructItem({ id: item.id, targetParentId })
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  }
}

const onItemFolderDragOver = (item, event) => {
  if (item.type !== 'folder') return
  onFolderDragOver(item, event)
}

const onItemFolderDragLeave = (item, event) => {
  if (item.type !== 'folder') return
  onFolderDragLeave(item, event)
}

const onItemFolderDrop = (item) => {
  if (item.type !== 'folder') return
  onDropToFolder(item)
}

const onFolderDragOver = (folder, event) => {
  const dragging = moveDraggingItem.value
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
  const item = moveDraggingItem.value
  onMoveDragEnd()
  if (!item || item.id === folder.id) return
  try {
    await moveStructItem({ id: item.id, targetParentId: folder.id })
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  }
}

// ---- 新建文件 ----
const openCreateNoteModal = async (fragmentNotes = []) => {
  const notes = Array.isArray(fragmentNotes) ? fragmentNotes : []
  if (notes.length > 0) {
    await requestUtoolsDetachIfNeeded()
  }
  pendingFragmentNotes.value = notes
  if (notes.length > 0) {
    const prefs = loadStructFolderPrefs()
    createNoteInitialPathStack.value = prefs.lastPathStack.length
      ? prefs.lastPathStack.map((item) => ({ id: item.id, name: item.name }))
      : []
  } else {
    createNoteInitialPathStack.value = pathStack.value.map((item) => ({
      id: item.id,
      name: item.name,
    }))
  }
  createNoteVisible.value = true
}

const handleAiUnavailable = () => {
  emit('error', new Error('请先在设置中配置 AI 服务'))
}

const closeCreateNoteModal = () => {
  if (noteSaving.value) return
  createNoteVisible.value = false
  pendingFragmentNotes.value = []
}

const handleCreateNote = async ({
  title,
  content,
  parentId,
  pathStack: savedPathStack = [],
  sourceFragmentIds = [],
  introducedFragmentIds = [],
  introducedFragmentMethods = {},
}) => {
  if (noteSaving.value) return
  noteSaving.value = true
  try {
    const fragmentIds = (Array.isArray(sourceFragmentIds) ? sourceFragmentIds : [])
      .map((id) => String(id))
      .filter(Boolean)
    const resolvedParentId = parentId ?? currentParentId.value
    const structNoteId = await createNoteInFolder({
      parentId: resolvedParentId,
      title,
      content,
      sourceFragmentIds: fragmentIds,
    })
    const introducedIds = (Array.isArray(introducedFragmentIds) ? introducedFragmentIds : [])
      .map((id) => String(id))
      .filter(Boolean)
    if (introducedIds.length || Object.keys(introducedFragmentMethods || {}).length) {
      await updateStructNote({
        id: structNoteId,
        title,
        content,
        sourceFragmentIds: fragmentIds,
        introducedFragmentIds: introducedIds,
        introducedFragmentMethods,
      })
    }
    if (hasPendingInlineImages(content)) {
      const finalizedContent = await finalizeInlineImagesInMarkdown(structNoteId, content)
      if (finalizedContent !== content) {
        await updateStructNote({
          id: structNoteId,
          title,
          content: finalizedContent,
          sourceFragmentIds: fragmentIds,
        })
      }
    }
    saveStructFolderPrefs({
      parentId: resolvedParentId,
      pathStack: savedPathStack,
    })
    let archivedIds = []
    if (fragmentIds.length) {
      archivedIds = await archiveFragmentNotes(fragmentIds, structNoteId)
      if (archivedIds.length) {
        emit('fragments-archived', archivedIds)
      }
    }
    pendingFragmentNotes.value = []
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
    if (isActive) {
      loadCurrentList()
    } else {
      closeActionMenu()
    }
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown)
  document.addEventListener('pointerdown', onDocumentPointerdown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerdown)
})

defineExpose({
  openCreateNoteModal,
  openNoteViewByNoteId,
  openFolderById,
  dismissOverlays,
  reload: loadCurrentList,
})
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0 12px;
  flex: 0 0 auto;
}

.sediment-header-text {
  min-width: 0;
}

.sediment-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 650;
  color: var(--color-primary);
}

.sediment-desc {
  margin: 0;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.sediment-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.sediment-breadcrumb {
  min-width: 0;
  margin: 0 0 14px;
  padding: 6px 10px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.035);
  border: 1px solid rgba(24, 24, 27, 0.045);
}

.breadcrumb-goto-todo {
  flex: 0 0 auto;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #0f766e;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.breadcrumb-goto-todo:hover {
  background: rgba(13, 148, 136, 0.12);
}

.sediment-state {
  margin: 48px 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
  flex: 1 1 auto;
}

.breadcrumb-root {
  display: inline-flex;
  align-items: center;
  margin-right: 2px;
  color: #a1a1aa;
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
  padding: 1px 5px;
  border-radius: 5px;
  color: #71717a;
  font-size: 12px;
  font-weight: 450;
  line-height: 1.4;
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
  padding: 1px 5px;
  color: #52525b;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0;
}

.breadcrumb-sep {
  color: #d4d4d8;
  font-size: 11px;
  user-select: none;
}

.sediment-create-file {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: auto;
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
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
}

.folder-grid-sortable,
.folder-grid-static {
  display: contents;
  margin: 0;
  padding: 0;
  list-style: none;
}

.folder-grid-item {
  flex: 0 0 auto;
}

.folder-card,
.folder-create,
.folder-create-form {
  width: 92px;
}

.folder-create,
.folder-create-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.folder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.folder-card-hit {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.folder-card-hit:focus-visible {
  outline: none;
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

.folder-sort-handle {
  cursor: grab;
}

.folder-sort-handle:active {
  cursor: grabbing;
}

.folder-sort-ghost {
  opacity: 0.92;
}

.folder-sort-ghost .folder-name {
  color: var(--color-primary);
  font-weight: 600;
}

.folder-sort-chosen .folder-icon-wrap {
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.14);
  border-color: rgba(37, 99, 235, 0.2);
}

.folder-sort-drag {
  opacity: 0.35;
}

.card-move-handle {
  cursor: grab;
}

.card-move-handle:active {
  cursor: grabbing;
}

.folder-item-wrap {
  width: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.folder-item-wrap.is-action-menu-open .folder-icon-wrap {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.2);
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 16px;
  padding: 0 2px;
}

.card-action-btn {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 7px;
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-secondary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
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

.folder-item-wrap:hover .folder-icon-wrap {
  box-shadow: 0 6px 18px rgba(24, 24, 27, 0.1);
  border-color: rgba(37, 99, 235, 0.12);
}

.folder-item-wrap:hover .folder-icon-wrap--note {
  box-shadow: var(--shadow-card);
  border-color: rgba(24, 24, 27, 0.06);
}

.folder-card-hit:focus-visible .folder-icon-wrap {
  box-shadow: var(--focus-ring), var(--shadow-card);
}

.folder-icon-wrap {
  position: relative;
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

.folder-icon-wrap--todo {
  color: #0f766e;
  border-color: rgba(15, 118, 110, 0.28);
  background: rgba(15, 118, 110, 0.06);
}

.folder-todo-badge {
  position: absolute;
  right: -6px;
  bottom: -5px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  border: 1px solid rgba(15, 118, 110, 0.35);
  background: #f0fdfa;
  color: #0f766e;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
  pointer-events: none;
  white-space: nowrap;
}

.folder-name {
  width: 100%;
  max-height: calc(1.35em * 2);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  word-break: break-word;
  white-space: normal;
  text-align: center;
}

.folder-name--todo {
  color: #0f766e;
}

.folder-card-meta {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.folder-create {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.folder-create.is-disabled,
.folder-create:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.folder-create.is-disabled:hover .folder-create-icon,
.folder-create:disabled:hover .folder-create-icon {
  border-color: var(--btn-dashed-border);
  background: rgba(255, 255, 255, 0.55);
  color: var(--color-secondary-text);
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
    padding-bottom: 12px;
  }

  .sediment-header-actions {
    align-self: stretch;
    justify-content: flex-end;
  }

  .folder-grid {
    gap: 14px 16px;
  }
}
</style>

<style>
.sediment-drag-ghost {
  position: fixed;
  top: -9999px;
  left: -9999px;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 220px;
  padding: 6px 10px 6px 6px;
  border-radius: 10px;
  border: 1px solid rgba(24, 24, 27, 0.08);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 4px 14px rgba(24, 24, 27, 0.12);
  pointer-events: none;
  font-family: var(--font-base);
}

.sediment-drag-ghost-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(202, 138, 4, 0.12);
  color: #ca8a04;
}

.sediment-drag-ghost-icon.is-note {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.sediment-drag-ghost-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #18181b;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}
</style>
