<template>
  <MainFrame :show-input-area="activeTab === 'home'">
    <template #sidebar>
      <SidePanel :active-tab="activeTab" @tab-change="onTabChange" />
    </template>

    <template #input>
      <FloatingInputBar
        ref="inputBarRef"
        v-model="inputValue"
        :submitting="noteSubmitting"
        :upload-progress="uploadProgress"
        @submit="handleSubmit"
        @limit-exceeded="handleLimitExceeded"
        @image-too-large="handleImageTooLarge"
      />
    </template>

    <template #content>
      <!-- 主页：v-show 保活 DOM，避免切回时重挂载阻塞侧栏选中态 -->
      <div v-show="activeTab === 'home'" class="tab-panel tab-panel--home">
        <div class="home-view-switcher">
          <NoteViewSwitcher
            :model-value="noteViewMode"
            :search-query="searchKeyword"
            :selected-count="selectedNoteIds.size"
            :selecting-active="noteSelectingActive"
            @update:model-value="onNoteViewModeChange"
            @search="onNoteSearch"
            @search-open="onNoteSearchOpen"
          />
        </div>

        <section
          v-show="noteViewMode === 'list' || noteViewMode === 'select' || noteViewMode === 'selected'"
          ref="noteListRef"
          class="note-list"
          :class="{ 'note-list--selecting': selectedNoteIds.size > 0 }"
          @scroll="onNoteListScroll"
        >
          <header v-if="showTagFilterChrome" class="tag-filter-summary">
            <span class="tag-filter-summary-label">
              标签
              <span class="tag-filter-summary-name">「{{ tagFilterState.tagName }}」</span>
            </span>
            <span class="tag-filter-summary-count">
              <template v-if="tagFilterState.loading">加载中…</template>
              <template v-else>共 {{ tagFilterState.total }} 条</template>
            </span>
            <motion.button
              type="button"
              class="tag-filter-summary-clear"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="clearTagFilter"
            >
              清空
            </motion.button>
          </header>

          <p
            v-if="
              noteSelectingActive
              && (noteViewMode === 'list' || noteViewMode === 'select')
              && isDisplayedNotesLoading
            "
            class="empty-state"
          >
            加载中…
          </p>

          <p v-else-if="isSearchActive && searchState.loading" class="empty-state">
            搜索中…
          </p>
          <p
            v-else-if="isSearchActive && !searchState.list.length"
            class="empty-state"
          >
            未找到与「{{ searchKeyword }}」相关的笔记。
          </p>

          <p
            v-else-if="
              !noteSelectingActive &&
              noteViewMode !== 'selected' &&
              !isSearchActive &&
              !tagFilterState.active &&
              !assistantStore.visibleNotes.length &&
              !assistantStore.loadingNotes
            "
            class="empty-state"
          >
            还没有笔记，先记录一条吧。
          </p>

          <p
            v-if="showTagFilterChrome && tagFilterState.loading"
            class="empty-state"
          >
            加载中…
          </p>
          <p
            v-else-if="showTagFilterChrome && !tagFilterState.list.length"
            class="empty-state"
          >
            标签「{{ tagFilterState.tagName }}」下暂无笔记。
          </p>
          <p
            v-else-if="
              noteSelectingActive &&
              (noteViewMode === 'list' || noteViewMode === 'select') &&
              !isSearchActive &&
              !tagFilterState.active &&
              !displayedNotes.length
            "
            class="empty-state"
          >
            还没有笔记，先记录一条吧。
          </p>

          <p
            v-else-if="noteViewMode === 'selected' && !selectedNotesList.length"
            class="empty-state"
          >
            暂无已选笔记。
          </p>
          <ul
            v-else-if="noteViewMode === 'selected'"
            class="note-list-items"
          >
            <li
              v-for="note in selectedNotesList"
              :key="`selected-${note.id}`"
              class="note-list-item"
            >
              <NoteCard
                :note="note"
                selectable
                selection-removable
                selected
                @toggle-select="toggleNoteSelect(note.id)"
              />
            </li>
          </ul>

          <ul
            v-else-if="showTagFilterChrome"
            class="note-list-items"
          >
            <li
              v-for="note in tagFilterState.list"
              :key="`tag-${tagFilterState.tagId}-${note.id}`"
              class="note-list-item"
            >
              <NoteCard
                :note="note"
                :selectable="showNoteSelectable"
                :selected="showNoteSelectable && isNoteSelected(note.id)"
                @edit-save="handleEditSave"
                @delete="handleDelete"
                @copied="handleCopied"
                @copy-failed="handleCopyFailed"
                @pin="handlePin"
                @image-too-large="handleImageTooLarge"
                @toggle-select="toggleNoteSelect(note.id)"
              />
            </li>
          </ul>

          <ul
            v-else-if="isSearchActive && searchState.list.length"
            class="note-list-items"
          >
            <li
              v-for="note in searchState.list"
              :key="`search-${note.id}`"
              class="note-list-item"
            >
              <NoteCard
                :note="note"
                :highlight="searchKeyword"
                :selectable="showNoteSelectable"
                :selected="showNoteSelectable && isNoteSelected(note.id)"
                @edit-save="handleEditSave"
                @delete="handleDelete"
                @copied="handleCopied"
                @copy-failed="handleCopyFailed"
                @pin="handlePin"
                @image-too-large="handleImageTooLarge"
                @toggle-select="toggleNoteSelect(note.id)"
              />
            </li>
          </ul>

          <AnimatePresence
            v-else-if="!tagFilterState.active"
            mode="popLayout"
            as="ul"
            class="note-list-items note-list-anim"
          >
            <motion.li
              v-for="note in assistantStore.visibleNotes"
              :key="note.id"
              class="note-list-item"
              layout
              :initial="presets.reveal.initial"
              :animate="presets.reveal.animate"
              :exit="presets.listItemExit"
            >
              <NoteCard
                :note="note"
                :selectable="showNoteSelectable"
                :selected="showNoteSelectable && isNoteSelected(note.id)"
                @edit-save="handleEditSave"
                @delete="handleDelete"
                @copied="handleCopied"
                @copy-failed="handleCopyFailed"
                @pin="handlePin"
                @image-too-large="handleImageTooLarge"
                @toggle-select="toggleNoteSelect(note.id)"
              />
            </motion.li>
          </AnimatePresence>

          <p
            v-if="showListLoadingMore"
            class="note-list-load-more"
          >
            加载更多…
          </p>
        </section>

        <div
          v-if="selectedNoteIds.size > 0"
          class="note-bulk-bar-wrap"
        >
          <NoteBulkActionBar
            :busy="bulkActionBusy"
            @ask-ai="handleBulkAskAi"
            @clear="handleBulkClearSelection"
            @sediment="handleBulkSediment"
            @delete="handleBulkDelete"
          />
        </div>

        <NoteTagCloud
          v-show="noteViewMode === 'tags'"
          :active="activeTab === 'home' && noteViewMode === 'tags'"
          @select="handleTagSelect"
          @deleted="handleTagDeleted"
          @updated="handleTagUpdated"
        />
      </div>

      <!-- AI 对话 -->
      <AiChatPanel
        ref="aiChatPanelRef"
        v-show="activeTab === 'ai'"
        :active="activeTab === 'ai'"
        @sediment-error="notifyError"
        @sediment-success="handleAiSedimentSuccess"
      />

      <!-- 沉淀 -->
      <SedimentPanel
        ref="sedimentPanelRef"
        v-show="activeTab === 'sediment'"
        :active="activeTab === 'sediment'"
        @error="notifyError"
      />

      <!-- 热力图 -->
      <HeatmapPanel
        v-show="activeTab === 'echo'"
        :active="activeTab === 'echo'"
      />

      <!-- 回收站 -->
      <TrashPanel
        ref="trashPanelRef"
        v-show="activeTab === 'trash'"
        :active="activeTab === 'trash'"
        @restored="handleRecycleRestored"
        @error="notifyError"
      />

      <!-- 设置 -->
      <AiSettingsPanel
        v-show="activeTab === 'settings'"
        :active="activeTab === 'settings'"
      />
    </template>
  </MainFrame>

  <CopyToast
    :visible="showToast"
    :text="toastText"
    :type="toastType"
    :action-label="toastActionLabel"
    @action="triggerToastAction"
  />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import CopyToast from '../components/feedback/CopyToast.vue'
import { useMotionPresets } from '../composables/useMotionPresets'
import FloatingInputBar from '../components/input/FloatingInputBar.vue'
import MainFrame from '../components/layout/MainFrame.vue'
import SedimentPanel from '../components/sediment/SedimentPanel.vue'
import HeatmapPanel from '../components/heatmap/HeatmapPanel.vue'
import TrashPanel from '../components/trash/TrashPanel.vue'
import AiChatPanel from '../components/ai/AiChatPanel.vue'
import AiSettingsPanel from '../components/settings/AiSettingsPanel.vue'
import SidePanel from '../components/layout/SidePanel.vue'
import NoteBulkActionBar from '../components/note/NoteBulkActionBar.vue'
import NoteCard from '../components/note/NoteCard.vue'
import NoteTagCloud from '../components/note/NoteTagCloud.vue'
import NoteViewSwitcher from '../components/note/NoteViewSwitcher.vue'
import { useCopyNote } from '../composables/useCopyNote'
import { ApiError } from '../api/http'
import {
  deleteBlock,
  fetchNotesByTag,
  NOTE_LIST_PAGE_SIZE,
  searchNotes,
} from '../api/note'
import { useAssistantStore } from '../stores/assistantStore'

const { presets } = useMotionPresets()

const inputValue = ref('')
const noteSubmitting = ref(false)
const uploadProgress = ref(0)
const inputBarRef = ref(null)
const assistantStore = useAssistantStore()

const activeTab = ref('home')
const noteViewMode = ref('list')
const searchKeyword = ref('')
const noteListRef = ref(null)
const sedimentPanelRef = ref(null)
const trashPanelRef = ref(null)
const aiChatPanelRef = ref(null)
const refreshNotesOnHomeEnter = ref(false)
const selectedNoteIds = ref(new Set())
const noteSelectingActive = ref(false)
const bulkActionBusy = ref(false)
let searchToken = 0

const searchState = reactive({
  loading: false,
  loadingMore: false,
  list: [],
  total: 0,
  pageNo: 0,
  hasMore: false,
})

const isSearchActive = computed(() => searchKeyword.value.length > 0)

const displayedNotes = computed(() => {
  if (tagFilterState.active) return tagFilterState.list
  if (isSearchActive.value) return searchState.list
  return assistantStore.visibleNotes
})

const selectedNotesList = computed(() => {
  const ids = [...selectedNoteIds.value]
  if (!ids.length) return []
  const byId = new Map()
  for (const note of assistantStore.visibleNotes) {
    if (note?.id) byId.set(note.id, note)
  }
  for (const note of searchState.list) {
    if (note?.id) byId.set(note.id, note)
  }
  for (const note of tagFilterState.list) {
    if (note?.id) byId.set(note.id, note)
  }
  return ids.map((id) => byId.get(id)).filter(Boolean)
})

const showNoteSelectable = computed(
  () => noteSelectingActive.value && noteViewMode.value !== 'selected',
)

const showTagFilterChrome = computed(
  () => tagFilterState.active && noteViewMode.value !== 'selected',
)

const isDisplayedNotesLoading = computed(() => {
  if (tagFilterState.active) return tagFilterState.loading
  if (isSearchActive.value) return searchState.loading
  return assistantStore.loadingNotes
})

const showListLoadingMore = computed(() => {
  if (noteViewMode.value === 'selected') return false
  if (isSearchActive.value) return searchState.loadingMore
  if (tagFilterState.active) return tagFilterState.loadingMore
  return assistantStore.loadingMoreNotes
})

const tagFilterState = reactive({
  active: false,
  loading: false,
  loadingMore: false,
  tagId: '',
  tagName: '',
  list: [],
  total: 0,
  pageNo: 0,
  hasMore: false,
})
let tagFilterToken = 0

const clearNoteSelection = () => {
  selectedNoteIds.value = new Set()
}

const isNoteSelected = (id) => selectedNoteIds.value.has(id)

const toggleNoteSelect = (id) => {
  const next = new Set(selectedNoteIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedNoteIds.value = next
}

const exitNoteSelectingSession = () => {
  noteSelectingActive.value = false
  clearNoteSelection()
}

const shouldExitEmptySelecting = () =>
  noteSelectingActive.value && selectedNoteIds.value.size === 0

const onNoteViewModeChange = (mode) => {
  const prev = noteViewMode.value
  if (mode === 'select') {
    if (prev === 'select' && noteSelectingActive.value) {
      exitNoteSelectingSession()
      noteViewMode.value = 'list'
      return
    }
    noteSelectingActive.value = true
    noteViewMode.value = 'select'
    return
  }
  if (mode === 'selected' && selectedNoteIds.value.size === 0) {
    noteViewMode.value = noteSelectingActive.value ? 'select' : 'list'
    return
  }
  if ((mode === 'list' || mode === 'tags') && shouldExitEmptySelecting()) {
    exitNoteSelectingSession()
  }
  noteViewMode.value = mode
}

const onNoteSearchOpen = () => {
  if (!shouldExitEmptySelecting()) return
  exitNoteSelectingSession()
  noteViewMode.value = 'list'
}

const handleBulkClearSelection = () => {
  exitNoteSelectingSession()
  clearTagFilter()
  onNoteSearch('')
  noteViewMode.value = 'list'
}

const scrollNoteListToTop = () => {
  const el = noteListRef.value
  if (!el) return
  el.scrollTop = 0
}

const appendSearchNotes = (list) => {
  const existing = new Set(searchState.list.map((note) => note.id))
  const next = list.filter((note) => note?.id && !existing.has(note.id))
  if (!next.length) return
  searchState.list = [...searchState.list, ...next]
}

const runNoteSearch = async (keyword, { reset = true } = {}) => {
  if (!reset && !searchState.hasMore) return
  if (searchState.loading || searchState.loadingMore) return

  const myToken = ++searchToken
  const page = reset ? 1 : searchState.pageNo + 1
  if (reset) {
    searchState.loading = true
    scrollNoteListToTop()
  } else {
    searchState.loadingMore = true
  }

  try {
    const result = await searchNotes({
      keyword,
      page,
      pageSize: NOTE_LIST_PAGE_SIZE,
    })
    if (myToken !== searchToken) return
    if (reset) {
      searchState.list = result.list
    } else {
      appendSearchNotes(result.list)
    }
    searchState.total = result.total
    searchState.pageNo = result.pageNo
    searchState.hasMore = result.hasMore
  } catch (error) {
    if (myToken !== searchToken) return
    if (reset) searchState.list = []
    notifyError(error)
  } finally {
    if (myToken === searchToken) {
      searchState.loading = false
      searchState.loadingMore = false
      if (reset) scrollNoteListToTop()
    }
  }
}

const loadMoreSearch = async () => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return
  await runNoteSearch(keyword, { reset: false })
}

const resetNoteSearch = () => {
  searchToken += 1
  searchState.loading = false
  searchState.loadingMore = false
  searchState.list = []
  searchState.total = 0
  searchState.pageNo = 0
  searchState.hasMore = false
}

const onNoteSearch = (keyword) => {
  const trimmed = keyword.trim()
  searchKeyword.value = trimmed
  if (!trimmed) {
    resetNoteSearch()
    scrollNoteListToTop()
    return
  }
  if (shouldExitEmptySelecting()) {
    exitNoteSelectingSession()
  }
  noteViewMode.value = 'list'
  clearTagFilter()
  runNoteSearch(trimmed)
}

const handleBulkDelete = () => {
  const ids = [...selectedNoteIds.value]
  if (!ids.length) return
  exitNoteSelectingSession()
  ids.forEach((id) => handleDelete({ id }))
}

const handleBulkSediment = () => {
  const ids = [...selectedNoteIds.value]
  if (!ids.length || bulkActionBusy.value) return

  const notes = selectedNotesList.value
  if (!notes.length) return

  exitNoteSelectingSession()
  noteViewMode.value = 'list'
  nextTick(() => {
    sedimentPanelRef.value?.openCreateNoteModal(notes)
  })
}

const handleBulkAskAi = () => {
  const notes = selectedNotesList.value
  if (!notes.length || bulkActionBusy.value) return

  exitNoteSelectingSession()
  noteViewMode.value = 'list'
  activeTab.value = 'ai'
  nextTick(() => {
    aiChatPanelRef.value?.attachNotes(notes)
  })
}

const onNoteListScroll = () => {
  const el = noteListRef.value
  if (
    !el ||
    activeTab.value !== 'home' ||
    (noteViewMode.value !== 'list'
      && noteViewMode.value !== 'select'
      && noteViewMode.value !== 'selected')
  ) {
    return
  }

  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  if (nearBottom) {
    if (noteViewMode.value !== 'list' && noteViewMode.value !== 'select') return

    if (isSearchActive.value) {
      loadMoreSearch()
    } else if (tagFilterState.active) {
      loadMoreTagNotes()
    } else {
      assistantStore.loadMoreNotes()
    }
  }
}

const appendTagNotes = (list) => {
  const existing = new Set(tagFilterState.list.map((note) => note.id))
  const next = list.filter((note) => note?.id && !existing.has(note.id))
  if (!next.length) return
  tagFilterState.list = [...tagFilterState.list, ...next]
}

const clearTagFilter = () => {
  tagFilterToken += 1
  tagFilterState.active = false
  tagFilterState.loading = false
  tagFilterState.loadingMore = false
  tagFilterState.tagId = ''
  tagFilterState.tagName = ''
  tagFilterState.list = []
  tagFilterState.total = 0
  tagFilterState.pageNo = 0
  tagFilterState.hasMore = false
}

const clearSearch = () => {
  resetNoteSearch()
  searchKeyword.value = ''
}

const handleTagSelect = async (tag) => {
  noteViewMode.value = 'list'
  if (searchKeyword.value) clearSearch()

  const tagId = tag?.tagId
  const tagName = tag?.tagName || '未命名'
  if (!tagId) return

  const myToken = ++tagFilterToken
  tagFilterState.active = true
  tagFilterState.tagId = tagId
  tagFilterState.tagName = tagName
  tagFilterState.loading = true
  tagFilterState.loadingMore = false
  tagFilterState.list = []
  tagFilterState.total = 0
  tagFilterState.pageNo = 0
  tagFilterState.hasMore = false

  try {
    const result = await fetchNotesByTag(tagId, {
      pageNo: 1,
      pageSize: NOTE_LIST_PAGE_SIZE,
    })
    if (myToken !== tagFilterToken) return
    tagFilterState.list = result.list
    tagFilterState.total = result.total
    tagFilterState.pageNo = result.pageNo
    tagFilterState.hasMore = result.hasMore
  } catch (error) {
    if (myToken !== tagFilterToken) return
    const local = assistantStore.visibleNotes.filter(
      (note) => (note.title || '') === tagName,
    )
    if (local.length) {
      tagFilterState.list = local
      tagFilterState.total = local.length
      tagFilterState.hasMore = false
    } else {
      tagFilterState.list = []
      tagFilterState.total = 0
      notifyError(error)
    }
  } finally {
    if (myToken === tagFilterToken) tagFilterState.loading = false
  }
}

const handleTagDeleted = async (tag) => {
  if (tagFilterState.active && String(tagFilterState.tagId) === String(tag?.tagId)) {
    clearTagFilter()
  }
  try {
    await assistantStore.loadInitialNotes()
  } catch (error) {
    notifyError(error)
  }
}

const handleTagUpdated = async (result) => {
  if (
    tagFilterState.active &&
    String(tagFilterState.tagId) === String(result?.tagId)
  ) {
    tagFilterState.tagName = result.tagName || tagFilterState.tagName
  }
  try {
    await assistantStore.loadInitialNotes()
  } catch (error) {
    notifyError(error)
  }
}

const loadMoreTagNotes = async () => {
  if (
    !tagFilterState.active ||
    !tagFilterState.hasMore ||
    tagFilterState.loading ||
    tagFilterState.loadingMore
  ) {
    return
  }

  const myToken = tagFilterToken
  tagFilterState.loadingMore = true
  try {
    const result = await fetchNotesByTag(tagFilterState.tagId, {
      pageNo: tagFilterState.pageNo + 1,
      pageSize: NOTE_LIST_PAGE_SIZE,
    })
    if (myToken !== tagFilterToken) return
    appendTagNotes(result.list)
    tagFilterState.pageNo = result.pageNo
    tagFilterState.hasMore = result.hasMore
  } catch (error) {
    if (myToken !== tagFilterToken) return
    notifyError(error)
  } finally {
    if (myToken === tagFilterToken) tagFilterState.loadingMore = false
  }
}

const flushHomeNotesRefresh = async () => {
  if (!refreshNotesOnHomeEnter.value) return
  refreshNotesOnHomeEnter.value = false
  try {
    await assistantStore.reloadNotes()
    openToast('已恢复笔记', 'success', { duration: 1600 })
  } catch (error) {
    notifyError(error)
  }
}

const handleRecycleRestored = async (note) => {
  refreshNotesOnHomeEnter.value = true
  clearTagFilter()
  clearSearch()
  noteViewMode.value = 'list'
  if (note) {
    assistantStore.insertRestoredNote(note)
  }
  if (activeTab.value === 'home') {
    await flushHomeNotesRefresh()
    return
  }
  activeTab.value = 'home'
}

const onTabChange = (tab) => {
  if (activeTab.value === tab) return
  activeTab.value = tab
}

watch(activeTab, (tab) => {
  if (tab === 'home') {
    flushHomeNotesRefresh()
  }
})

const {
  showToast,
  toastText,
  toastType,
  toastActionLabel,
  openToast,
  triggerToastAction,
} = useCopyNote()

const handleAiSedimentSuccess = () => {
  openToast('已保存到沉淀', 'success', { duration: 1600 })
}

const deleteTimers = new Map()

const handleSubmit = async ({ text, images, tagId, tagName }) => {
  if (noteSubmitting.value) return
  noteSubmitting.value = true
  uploadProgress.value = 0
  try {
    await assistantStore.addNote(text, images, (p) => {
      uploadProgress.value = p
    }, { tagId, tagName })
    inputValue.value = ''
    inputBarRef.value?.reset()
  } catch (error) {
    notifyError(error)
  } finally {
    noteSubmitting.value = false
    uploadProgress.value = 0
  }
}

const handleLimitExceeded = (max) => {
  openToast(`最多支持 ${max} 张图片`, 'error', { duration: 1800 })
}

const handleImageTooLarge = () => {
  openToast('单张图片须小于 10 MB', 'error', { duration: 2200 })
}

const handleEditSave = async ({
  id,
  title,
  content,
  tagId,
  tagName,
  retainedImageIds,
  newImages,
}) => {
  try {
    await assistantStore.updateNote(id, title, content, {
      tagId,
      tagName,
      retainedImageIds,
      newImages,
    })
    openToast('已保存修改', 'success')
  } catch (error) {
    notifyError(error)
    throw error
  }
}

const handleDelete = ({ id }) => {
  if (deleteTimers.has(id)) return

  if (assistantStore.editingNoteId === id) {
    assistantStore.setEditingNoteId(null)
  }
  assistantStore.setNotePendingDelete(id, true)

  const timer = window.setTimeout(async () => {
    deleteTimers.delete(id)
    try {
      await deleteBlock(id)
      assistantStore.removeNoteLocal(id)
      trashPanelRef.value?.reload()
    } catch (error) {
      assistantStore.setNotePendingDelete(id, false)
      notifyError(error)
    }
  }, 3000)

  deleteTimers.set(id, timer)

  openToast('笔记已删除', 'success', {
    duration: 3000,
    actionLabel: '撤销',
    onAction: () => handleUndoDelete(id),
  })
}

const handleUndoDelete = (id) => {
  const t = deleteTimers.get(id)
  if (t) {
    clearTimeout(t)
    deleteTimers.delete(id)
  }
  assistantStore.setNotePendingDelete(id, false)
}

const handlePin = async ({ id, pinWeightValue }) => {
  try {
    await assistantStore.setPinNote(id, pinWeightValue)
    const tip =
      pinWeightValue === 'TOP'
        ? '已置顶'
        : pinWeightValue === 'BOTTOM'
          ? '已置底'
          : '已取消'
    openToast(tip, 'success', { duration: 1600 })
  } catch (error) {
    notifyError(error)
  }
}

const handleCopied = () => {
  openToast('已复制纯文本', 'success', { duration: 1600 })
}

const handleCopyFailed = () => {
  openToast('复制失败', 'error', { duration: 1600 })
}

const notifyError = (error) => {
  if (error instanceof ApiError) {
    openToast(`[${error.code}] ${error.msg}`, 'error')
    return
  }
  const message = error?.message || '系统异常'
  openToast(`[UNKNOWN] ${message}`, 'error')
}

watch(
  () => selectedNoteIds.value.size,
  (count) => {
    if (count === 0 && noteViewMode.value === 'selected') {
      noteViewMode.value = noteSelectingActive.value ? 'select' : 'list'
    }
  },
)

onMounted(async () => {
  try {
    await assistantStore.loadInitialNotes()
  } catch (error) {
    notifyError(error)
  }
  await nextTick()
  inputBarRef.value?.focus()
})

onBeforeUnmount(() => {
  deleteTimers.forEach((timer) => clearTimeout(timer))
  deleteTimers.clear()
})
</script>

<style scoped>
.tab-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.tab-panel--home {
  position: relative;
  overflow: hidden;
}

.note-bulk-bar-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 16px;
  z-index: 4;
  display: flex;
  justify-content: center;
  padding: 0 4px;
  box-sizing: border-box;
  pointer-events: none;
}

.note-bulk-bar-wrap > * {
  pointer-events: auto;
}

.note-list--selecting {
  padding-bottom: 92px;
}

.home-view-switcher {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  min-height: 36px;
  width: 100%;
  max-width: var(--frame-inner-width);
  margin-bottom: 10px;
  box-sizing: border-box;
}

.note-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 4px 28px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(24, 24, 27, 0.18) transparent;
}

.note-list > * {
  width: 100%;
  max-width: var(--frame-inner-width);
  box-sizing: border-box;
}

.note-list-item {
  width: 100%;
  max-width: var(--frame-inner-width);
  list-style: none;
}

.note-list-items {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.note-list-anim {
  position: relative;
}

.note-list::-webkit-scrollbar {
  width: 8px;
}

.note-list::-webkit-scrollbar-track {
  background: transparent;
}

.note-list::-webkit-scrollbar-thumb {
  background: rgba(24, 24, 27, 0.18);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.note-list::-webkit-scrollbar-thumb:hover {
  background: rgba(24, 24, 27, 0.32);
  background-clip: content-box;
}

.empty-state {
  margin: 48px 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
}

.note-list-load-more {
  width: 100%;
  margin: 4px 0 12px;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 13px;
}

.tag-filter-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: var(--radius-md);
  background: rgba(37, 99, 235, 0.06);
  color: var(--color-secondary-text);
  font-size: 13px;
}

.tag-filter-summary-label {
  font-weight: 500;
  color: var(--color-primary);
}

.tag-filter-summary-name {
  color: var(--color-accent);
  font-weight: 600;
}

.tag-filter-summary-count {
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.tag-filter-summary-clear {
  border: 0;
  background: transparent;
  color: var(--color-secondary-text);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.tag-filter-summary-clear:hover {
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-primary);
}

.placeholder-panel {
  align-items: center;
  justify-content: center;
  padding-top: 12vh;
}

.placeholder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-secondary-text);
  text-align: center;
}

.placeholder-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.placeholder-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  max-width: 260px;
}
</style>
