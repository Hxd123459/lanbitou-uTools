<template>
  <MainFrame :show-input-area="activeTab === 'home'">
    <template #sidebar>
      <SidePanel
        :active-tab="activeTab"
        @tab-change="onTabChange"
        @global-search-select="handleGlobalSearchSelect"
      />
    </template>

    <template #input>
      <FloatingInputBar
        ref="inputBarRef"
        v-model="inputValue"
        :submitting="noteSubmitting"
        :upload-progress="uploadProgress"
        :context-tag="inputContextTag"
        @submit="handleSubmit"
        @limit-exceeded="handleLimitExceeded"
        @image-too-large="handleImageTooLarge"
        @file-too-large="handleFileTooLarge"
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
          <header v-if="showDateFilterChrome" class="tag-filter-summary">
            <span class="tag-filter-summary-label">
              日期
              <span class="tag-filter-summary-name">「{{ dateFilterState.label }}」</span>
            </span>
            <span class="tag-filter-summary-count">
              <template v-if="dateFilterState.loading">加载中…</template>
              <template v-else>共 {{ dateFilterState.total }} 条</template>
            </span>
            <motion.button
              type="button"
              class="tag-filter-summary-clear"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="clearDateFilter"
            >
              清空
            </motion.button>
          </header>

          <header v-else-if="showTagFilterChrome" class="tag-filter-summary">
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
              !dateFilterState.active &&
              assistantStore.loadingNotes &&
              !assistantStore.visibleNotes.length
            "
            class="empty-state"
          >
            加载中…
          </p>
          <p
            v-else-if="
              !noteSelectingActive &&
              noteViewMode !== 'selected' &&
              !isSearchActive &&
              !tagFilterState.active &&
              !dateFilterState.active &&
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
              !dateFilterState.active &&
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
                @tag-select="handleTagSelect"
              />
            </li>
          </ul>

          <p
            v-if="showDateFilterChrome && dateFilterState.loading"
            class="empty-state"
          >
            加载中…
          </p>
          <p
            v-else-if="showDateFilterChrome && !dateFilterState.list.length"
            class="empty-state"
          >
            {{ dateFilterState.label ? `「${dateFilterState.label}」` : '' }} 暂无碎片笔记。
          </p>

          <ul
            v-else-if="showDateFilterChrome"
            class="note-list-items"
          >
            <li
              v-for="note in dateFilterState.list"
              :key="`date-${dateFilterState.dateKey}-${note.id}`"
              class="note-list-item"
            >
              <NoteCard
                :note="note"
                :selectable="showNoteSelectable && !isNoteBulkAiTagBusy(note.id)"
                :selected="showNoteSelectable && isNoteSelected(note.id)"
                :tag-ai-loading="isNoteBulkAiTagBusy(note.id)"
                @edit-save="handleEditSave"
                @delete="handleDelete"
                @copied="handleCopied"
                @copy-failed="handleCopyFailed"
                @pin="handlePin"
                @image-too-large="handleImageTooLarge"
                @file-too-large="handleFileTooLarge"
                @toggle-select="toggleNoteSelect(note.id)"
                @tag-select="handleTagSelect"
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
                :selectable="showNoteSelectable && !isNoteBulkAiTagBusy(note.id)"
                :selected="showNoteSelectable && isNoteSelected(note.id)"
                :tag-ai-loading="isNoteBulkAiTagBusy(note.id)"
                @edit-save="handleEditSave"
                @delete="handleDelete"
                @copied="handleCopied"
                @copy-failed="handleCopyFailed"
                @pin="handlePin"
                @image-too-large="handleImageTooLarge"
                @file-too-large="handleFileTooLarge"
                @toggle-select="toggleNoteSelect(note.id)"
                @tag-select="handleTagSelect"
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
                :selectable="showNoteSelectable && !isNoteBulkAiTagBusy(note.id)"
                :selected="showNoteSelectable && isNoteSelected(note.id)"
                :tag-ai-loading="isNoteBulkAiTagBusy(note.id)"
                @edit-save="handleEditSave"
                @delete="handleDelete"
                @copied="handleCopied"
                @copy-failed="handleCopyFailed"
                @pin="handlePin"
                @image-too-large="handleImageTooLarge"
                @file-too-large="handleFileTooLarge"
                @toggle-select="toggleNoteSelect(note.id)"
                @tag-select="handleTagSelect"
              />
            </li>
          </ul>

          <AnimatePresence
            v-else-if="!tagFilterState.active && !dateFilterState.active"
            mode="popLayout"
            as="ul"
            class="note-list-items note-list-anim"
          >
            <motion.li
              v-for="note in assistantStore.visibleNotes"
              :key="note.id"
              class="note-list-item"
              :data-note-id="note.id"
              layout
              :initial="presets.reveal.initial"
              :animate="presets.reveal.animate"
              :exit="presets.listItemExit"
            >
              <NoteCard
                :note="note"
                :selectable="showNoteSelectable && !isNoteBulkAiTagBusy(note.id)"
                :selected="showNoteSelectable && isNoteSelected(note.id)"
                :tag-ai-loading="isNoteBulkAiTagBusy(note.id)"
                @edit-save="handleEditSave"
                @delete="handleDelete"
                @copied="handleCopied"
                @copy-failed="handleCopyFailed"
                @pin="handlePin"
                @image-too-large="handleImageTooLarge"
                @file-too-large="handleFileTooLarge"
                @toggle-select="toggleNoteSelect(note.id)"
                @tag-select="handleTagSelect"
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
          ref="bulkBarWrapRef"
          class="note-bulk-bar-wrap"
        >
          <NoteBulkActionBar
            ref="bulkActionBarRef"
            :busy="bulkActionBusy"
            @ask-ai="handleBulkAskAi"
            @tag="openBulkTagMenu"
            @clear-tags="handleBulkClearTags"
            @clear="handleBulkClearSelection"
            @sediment="handleBulkSediment"
            @delete="handleBulkDelete"
          />
        </div>

        <NoteBulkTagMenu
          :visible="bulkTagMenuOpen"
          :anchor-el="bulkTagAnchorEl"
          @select="handleBulkApplyTag"
          @ai-tag="startBulkAiTag"
          @close="bulkTagMenuOpen = false"
        />

        <BulkAiTagProgress
          :visible="bulkAiTagSession.active"
          :done="bulkAiTagDone"
          :total="bulkAiTagTotal"
        />

        <NoteTagCloud
          ref="noteTagCloudRef"
          v-show="noteViewMode === 'tags'"
          :active="activeTab === 'home' && noteViewMode === 'tags'"
          @select="handleTagSelect"
          @deleted="handleTagDeleted"
          @updated="handleTagUpdated"
        />

        <WritingStatsPanel
          v-show="noteViewMode === 'stats'"
          :active="activeTab === 'home' && noteViewMode === 'stats'"
          @open-day="handleStatsOpenDay"
        />
      </div>

      <!-- AI 对话 -->
      <AiChatPanel
        ref="aiChatPanelRef"
        v-show="activeTab === 'ai'"
        :active="activeTab === 'ai'"
      />

      <!-- 沉淀 -->
      <SedimentPanel
        ref="sedimentPanelRef"
        v-show="activeTab === 'sediment'"
        :active="activeTab === 'sediment'"
        @error="notifyError"
        @fragments-archived="handleFragmentsArchived"
        @fragment-restored="handleFragmentRestored"
        @moved-to-recycle="handleMovedToRecycle"
      />

      <!-- 热力图 -->
        <HeatmapPanel
          v-show="activeTab === 'echo'"
          :active="activeTab === 'echo'"
          @open-day="handleHeatmapOpenDay"
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
      <SettingsPanel
        ref="settingsPanelRef"
        v-show="activeTab === 'settings'"
        :active="activeTab === 'settings'"
        :pending-auto-tag-setup="pendingAutoTagSetup"
        @auto-tag-enabled="handleAutoTagEnabled"
        @imported="handleBackupImported"
        @error="notifyError"
      />
    </template>
  </MainFrame>

  <CopyToast
    :visible="showToast"
    :text="toastText"
    :type="toastType"
    :action-label="toastActionLabel"
    :dismiss-mode="toastDismissMode"
    @action="triggerToastAction"
    @close="closeToast"
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
import SettingsPanel from '../components/settings/SettingsPanel.vue'
import SidePanel from '../components/layout/SidePanel.vue'
import NoteBulkActionBar from '../components/note/NoteBulkActionBar.vue'
import NoteBulkTagMenu from '../components/note/NoteBulkTagMenu.vue'
import BulkAiTagProgress from '../components/note/BulkAiTagProgress.vue'
import NoteCard from '../components/note/NoteCard.vue'
import NoteTagCloud from '../components/note/NoteTagCloud.vue'
import WritingStatsPanel from '../components/note/WritingStatsPanel.vue'
import NoteViewSwitcher from '../components/note/NoteViewSwitcher.vue'
import { isUntaggedTag } from '../constants/noteTag'
import { invalidateTagList } from '../composables/tagListSync'
import { useCopyNote } from '../composables/useCopyNote'
import { registerSettingsNavigator } from '../composables/useSettingsNavigation'
import {
  isClipboardEnterAction,
  onClipboardEnter,
  payloadToImageFile,
  shouldSkipClipboardEnterImage,
  isLocalImagePasteTargetActive,
  takePendingClipboardAction,
} from '../composables/useUtoolsClipboardEnter'
import { generateNoteTitle, isUtoolsAiAvailable, shouldAutoTagContent } from '../ai/aiService'
import { isUtoolsMode } from '../storage/env'
import { loadAiSettings } from '../storage/utools/aiSettings'
import { ApiError } from '../api/http'
import {
  deleteBlock,
  fetchBlockListByDate,
  fetchNotesByTag,
  NOTE_LIST_PAGE_SIZE,
  searchNotes,
} from '../api/note'
import { useAssistantStore } from '../stores/assistantStore'
import { formatDisplayDate, toDateKey } from '../composables/useWritingStats'

const { presets } = useMotionPresets()

const inputValue = ref('')
const noteSubmitting = ref(false)
const uploadProgress = ref(0)
const inputBarRef = ref(null)
const settingsPanelRef = ref(null)
const pendingAutoTagSetup = ref(false)
const assistantStore = useAssistantStore()

const activeTab = ref('home')
const noteViewMode = ref('list')
const searchKeyword = ref('')
const noteListRef = ref(null)
const sedimentPanelRef = ref(null)
const trashPanelRef = ref(null)
const aiChatPanelRef = ref(null)
const refreshNotesOnHomeEnter = ref(false)
const refreshNotesOnListEnter = ref(false)
const selectedNoteIds = ref(new Set())
const noteSelectingActive = ref(false)
const bulkActionBusy = ref(false)
const bulkTagMenuOpen = ref(false)
const bulkBarWrapRef = ref(null)
const bulkActionBarRef = ref(null)
const noteTagCloudRef = ref(null)

const bulkTagAnchorEl = computed(() => {
  const anchor = bulkActionBarRef.value?.tagAnchorEl
  if (!anchor) return null
  if (anchor instanceof HTMLElement) return anchor
  const raw = anchor.value ?? anchor
  if (raw instanceof HTMLElement) return raw
  if (raw?.$el instanceof HTMLElement) return raw.$el
  return null
})

const bulkAiTagSession = reactive({
  active: false,
  total: 0,
})
const bulkAiTagProcessedIds = ref(new Set())
const bulkAiTagQueue = ref([])
const bulkAiTagProcessingId = ref(null)
let bulkAiTagWorkerToken = 0
let bulkAiTagWorkerRunning = false

const bulkAiTagTotal = computed(() => bulkAiTagSession.total)

const bulkAiTagDone = computed(() => bulkAiTagProcessedIds.value.size)

const isNoteBulkAiTagBusy = (id) => {
  if (!bulkAiTagSession.active) return false
  const key = String(id)
  if (bulkAiTagProcessingId.value === key) return true
  return bulkAiTagQueue.value.includes(key)
}
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
  if (dateFilterState.active) return dateFilterState.list
  if (tagFilterState.active) return tagFilterState.list
  if (isSearchActive.value) return searchState.list
  return assistantStore.visibleNotes
})

const registerSelectedNote = (note, byId) => {
  if (!note?.id) return
  byId.set(String(note.id), note)
}

const selectedNotesList = computed(() => {
  const ids = [...selectedNoteIds.value]
  if (!ids.length) return []
  const byId = new Map()
  for (const note of assistantStore.visibleNotes) {
    registerSelectedNote(note, byId)
  }
  for (const note of searchState.list) {
    registerSelectedNote(note, byId)
  }
  for (const note of tagFilterState.list) {
    registerSelectedNote(note, byId)
  }
  for (const note of dateFilterState.list) {
    registerSelectedNote(note, byId)
  }
  return ids.map((id) => byId.get(String(id))).filter(Boolean)
})

const applyTagFieldsToNote = (note, { tagId, tagName } = {}) => {
  if (!note) return
  const hasTag = tagId != null && tagId !== ''
  if (hasTag) {
    note.title = tagName || note.title || ''
    note.tagId = tagId
    return
  }
  note.title = ''
  note.tagId = null
}

const showNoteSelectable = computed(
  () => noteSelectingActive.value && noteViewMode.value !== 'selected',
)

const showTagFilterChrome = computed(
  () => tagFilterState.active && noteViewMode.value !== 'selected',
)

const isDisplayedNotesLoading = computed(() => {
  if (dateFilterState.active) return dateFilterState.loading
  if (tagFilterState.active) return tagFilterState.loading
  if (isSearchActive.value) return searchState.loading
  return assistantStore.loadingNotes
})

const showListLoadingMore = computed(() => {
  if (noteViewMode.value === 'selected') return false
  if (dateFilterState.active) return dateFilterState.loadingMore
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
let dateFilterToken = 0

const dateFilterState = reactive({
  active: false,
  dateKey: '',
  label: '',
  list: [],
  total: 0,
  loading: false,
  loadingMore: false,
  pageNo: 0,
  hasMore: false,
})

const showDateFilterChrome = computed(
  () => dateFilterState.active && noteViewMode.value !== 'selected',
)

const inputContextTag = computed(() => {
  if (!tagFilterState.active || !tagFilterState.tagId) return null
  if (isUntaggedTag({ tagId: tagFilterState.tagId })) return null
  return {
    tagId: tagFilterState.tagId,
    tagName: tagFilterState.tagName || '未命名',
  }
})

function noteMatchesTagFilter(note, tagId, tagName) {
  if (!note?.id) return false
  if (isUntaggedTag({ tagId })) return !note.tagId
  if (tagId && String(note.tagId || '') === String(tagId)) return true
  return (note.title || '') === tagName
}

function appendNoteToTagFilter(note) {
  if (!tagFilterState.active || !note?.id) return
  if (
    !noteMatchesTagFilter(note, tagFilterState.tagId, tagFilterState.tagName)
  ) {
    return
  }
  if (tagFilterState.list.some((item) => item.id === note.id)) return
  tagFilterState.list = [note, ...tagFilterState.list]
  tagFilterState.total += 1
}

function appendNoteToDateFilter(note) {
  if (!dateFilterState.active || !note?.id || !dateFilterState.dateKey) return
  if (toDateKey(note.createdAt) !== dateFilterState.dateKey) return
  if (dateFilterState.list.some((item) => item.id === note.id)) return
  dateFilterState.list = [note, ...dateFilterState.list]
  dateFilterState.total += 1
}

function stashAndRemoveFromFilterLists(id) {
  const sid = String(id)
  const snapshot = deleteSnapshots.get(id) || {}

  if (tagFilterState.active) {
    const index = tagFilterState.list.findIndex((note) => String(note.id) === sid)
    if (index >= 0) {
      snapshot.tagNote = tagFilterState.list[index]
      tagFilterState.list = tagFilterState.list.filter((note) => String(note.id) !== sid)
      tagFilterState.total = Math.max(0, tagFilterState.total - 1)
    }
  }

  if (dateFilterState.active) {
    const index = dateFilterState.list.findIndex((note) => String(note.id) === sid)
    if (index >= 0) {
      snapshot.dateNote = dateFilterState.list[index]
      dateFilterState.list = dateFilterState.list.filter((note) => String(note.id) !== sid)
      dateFilterState.total = Math.max(0, dateFilterState.total - 1)
    }
  }

  if (isSearchActive.value) {
    const index = searchState.list.findIndex((note) => String(note.id) === sid)
    if (index >= 0) {
      snapshot.searchNote = searchState.list[index]
      searchState.list = searchState.list.filter((note) => String(note.id) !== sid)
      searchState.total = Math.max(0, searchState.total - 1)
    }
  }

  if (snapshot.tagNote || snapshot.dateNote || snapshot.searchNote) {
    deleteSnapshots.set(id, snapshot)
  }
}

function restoreFromDeleteSnapshot(id) {
  const snapshot = deleteSnapshots.get(id)
  if (!snapshot) return

  if (snapshot.tagNote) {
    appendNoteToTagFilter(snapshot.tagNote)
  }

  if (snapshot.dateNote) {
    appendNoteToDateFilter(snapshot.dateNote)
  }

  if (snapshot.searchNote && isSearchActive.value) {
    if (!searchState.list.some((note) => note.id === snapshot.searchNote.id)) {
      searchState.list = [snapshot.searchNote, ...searchState.list]
      searchState.total += 1
    }
  }

  deleteSnapshots.delete(id)
}

function removeNotesFromHomeLists(ids = []) {
  const idSet = new Set((Array.isArray(ids) ? ids : []).map(String))
  if (!idSet.size) return

  idSet.forEach((id) => {
    assistantStore.removeNoteLocal(id)
  })

  if (tagFilterState.active) {
    const next = tagFilterState.list.filter((note) => !idSet.has(String(note.id)))
    const removedCount = tagFilterState.list.length - next.length
    tagFilterState.list = next
    if (removedCount > 0) {
      tagFilterState.total = Math.max(0, tagFilterState.total - removedCount)
    }
  }

  if (dateFilterState.active) {
    const next = dateFilterState.list.filter((note) => !idSet.has(String(note.id)))
    const removedCount = dateFilterState.list.length - next.length
    dateFilterState.list = next
    if (removedCount > 0) {
      dateFilterState.total = Math.max(0, dateFilterState.total - removedCount)
    }
  }

  if (searchState.list.length) {
    const nextSearch = searchState.list.filter((note) => !idSet.has(String(note.id)))
    const removedCount = searchState.list.length - nextSearch.length
    if (removedCount > 0) {
      searchState.list = nextSearch
      searchState.total = Math.max(0, searchState.total - removedCount)
    }
  }

  if (noteSelectingActive.value) {
    const nextSelected = new Set(
      [...selectedNoteIds.value].filter((id) => !idSet.has(String(id))),
    )
    selectedNoteIds.value = nextSelected
    if (shouldExitEmptySelecting()) {
      exitNoteSelectingSession()
    }
  }
}

const handleFragmentsArchived = (ids) => {
  removeNotesFromHomeLists(ids)
  openToast('已沉淀，相关碎片已从列表移出', 'success', { duration: 1800 })
}

const handleFragmentRestored = (note) => {
  if (!note?.id) return
  assistantStore.insertRestoredNote(note)
  appendNoteToTagFilter(note)
  appendNoteToDateFilter(note)
  openToast('已放回碎片列表', 'success', { duration: 1600 })
}

const clearNoteSelection = () => {
  selectedNoteIds.value = new Set()
}

const isNoteSelected = (id) => selectedNoteIds.value.has(id)

const toggleNoteSelect = (id) => {
  if (isNoteBulkAiTagBusy(id)) return
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
  if ((mode === 'list' || mode === 'tags' || mode === 'stats') && shouldExitEmptySelecting()) {
    exitNoteSelectingSession()
  }
  if ((mode === 'tags' || mode === 'stats') && tagFilterState.active) {
    clearTagFilter()
  }
  if ((mode === 'tags' || mode === 'stats') && dateFilterState.active) {
    clearDateFilter()
  }
  noteViewMode.value = mode
  if ((mode === 'list' || mode === 'select') && prev === 'tags') {
    void flushNotesRefreshOnListEnter()
    if (
      !tagFilterState.active &&
      !isSearchActive.value &&
      !assistantStore.visibleNotes.length &&
      !assistantStore.loadingNotes
    ) {
      void assistantStore.loadInitialNotes()
    }
  }
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

  bulkTagMenuOpen.value = false
  exitNoteSelectingSession()
  noteViewMode.value = 'list'
  activeTab.value = 'ai'
  nextTick(() => {
    aiChatPanelRef.value?.attachNotes(notes)
  })
}

const getNoteContent = (note) =>
  note?.markdownContent || note?.text || note?.rawContent || ''

const getNoteRetainedImageIds = (note) =>
  (Array.isArray(note?.images) ? note.images : [])
    .map((item) => item?.id)
    .filter((id) => id != null)

const openBulkTagMenu = () => {
  if (bulkActionBusy.value) return
  if (!selectedNotesList.value.length) return
  bulkTagMenuOpen.value = !bulkTagMenuOpen.value
}

const isBulkAiTagAvailable = () => {
  if (!isUtoolsMode()) return false
  const settings = loadAiSettings()
  if (settings.provider === 'utools') return isUtoolsAiAvailable()
  return Boolean(String(settings.apiKey ?? '').trim() && String(settings.baseUrl ?? '').trim())
}

const markBulkAiTagProcessed = (id) => {
  const next = new Set(bulkAiTagProcessedIds.value)
  next.add(String(id))
  bulkAiTagProcessedIds.value = next
}

const findNoteForBulkAiTag = (id) => {
  const targetId = String(id)
  const byId = new Map()
  for (const note of assistantStore.visibleNotes) {
    if (note?.id) byId.set(String(note.id), note)
  }
  for (const note of searchState.list) {
    if (note?.id) byId.set(String(note.id), note)
  }
  for (const note of tagFilterState.list) {
    if (note?.id) byId.set(String(note.id), note)
  }
  return byId.get(targetId) ?? null
}

const enqueueBulkAiTagNotes = (ids) => {
  let added = 0
  for (const id of ids) {
    const key = String(id)
    if (bulkAiTagProcessedIds.value.has(key)) continue
    if (isNoteBulkAiTagBusy(key)) continue
    bulkAiTagQueue.value.push(key)
    added += 1
  }
  if (added) bulkAiTagSession.total += added
  return added
}

const isBulkAiTagSettled = () =>
  bulkAiTagQueue.value.length === 0 && !bulkAiTagProcessingId.value

const finishBulkAiTagSession = async (token) => {
  if (token !== bulkAiTagWorkerToken || !bulkAiTagSession.active) return

  bulkAiTagSession.active = false
  bulkAiTagSession.total = 0
  bulkAiTagProcessedIds.value = new Set()
  bulkAiTagQueue.value = []
  bulkAiTagProcessingId.value = null

  invalidateTagList()
  noteTagCloudRef.value?.reload?.()
  if (tagFilterState.active) {
    await reloadActiveTagFilter()
  }

  openToast('AI自动打标完成！', 'success', { duration: 1800 })
}

const tagNoteWithAi = async (note) => {
  const content = getNoteContent(note)
  if (!shouldAutoTagContent(content)) return

  const tagName = await generateNoteTitle(content)
  if (!tagName) return

  await assistantStore.updateNote(note.id, tagName, content, {
    tagName,
    retainedImageIds: getNoteRetainedImageIds(note),
  })
}

const runBulkAiTagWorker = async (token) => {
  bulkAiTagWorkerRunning = true
  try {
    while (token === bulkAiTagWorkerToken && bulkAiTagSession.active) {
      const nextId = bulkAiTagQueue.value.shift()
      if (!nextId) {
        if (isBulkAiTagSettled()) break
        await new Promise((resolve) => window.setTimeout(resolve, 300))
        continue
      }

      bulkAiTagProcessingId.value = nextId
      const note = findNoteForBulkAiTag(nextId)

      try {
        if (note) await tagNoteWithAi(note)
      } catch (error) {
        console.warn('[烂笔头] 批量 AI 打标失败', error)
      } finally {
        markBulkAiTagProcessed(nextId)
        bulkAiTagProcessingId.value = null
      }
    }

    if (token !== bulkAiTagWorkerToken || !bulkAiTagSession.active) return
    await finishBulkAiTagSession(token)
  } finally {
    if (token === bulkAiTagWorkerToken) {
      bulkAiTagWorkerRunning = false
    }
  }
}

const startBulkAiTag = () => {
  if (!selectedNoteIds.value.size) return
  if (!isBulkAiTagAvailable()) {
    openToast('请先在设置中配置 AI 服务', 'error', { duration: 2200 })
    return
  }

  bulkTagMenuOpen.value = false

  const newIds = [...selectedNoteIds.value]
    .map(String)
    .filter(
      (id) =>
        !bulkAiTagProcessedIds.value.has(id) && !isNoteBulkAiTagBusy(id),
    )

  if (!newIds.length && !bulkAiTagSession.active) return

  if (!bulkAiTagSession.active) {
    bulkAiTagSession.active = true
    bulkAiTagSession.total = 0
    bulkAiTagProcessedIds.value = new Set()
    bulkAiTagQueue.value = []
    bulkAiTagProcessingId.value = null
  }

  enqueueBulkAiTagNotes(newIds)
  exitNoteSelectingSession()
  noteViewMode.value = 'list'

  if (bulkAiTagWorkerRunning) return

  bulkAiTagWorkerToken += 1
  const token = bulkAiTagWorkerToken
  void runBulkAiTagWorker(token)
}

const handleBulkApplyTag = async (tag) => {
  const notes = selectedNotesList.value
  if (!notes.length || bulkActionBusy.value || !tag?.tagId) return

  bulkActionBusy.value = true
  bulkTagMenuOpen.value = false
  try {
    for (const note of notes) {
      await assistantStore.updateNote(
        note.id,
        tag.tagName,
        getNoteContent(note),
        {
          tagId: tag.tagId,
          tagName: tag.tagName,
          retainedImageIds: getNoteRetainedImageIds(note),
        },
      )
      applyTagFieldsToNote(note, tag)
    }
    invalidateTagList()
    noteTagCloudRef.value?.reload?.()
    if (tagFilterState.active) {
      await reloadActiveTagFilter()
    }
    openToast(`已为 ${notes.length} 条笔记打上标签「${tag.tagName}」`, 'success', {
      duration: 1800,
    })
    exitNoteSelectingSession()
    noteViewMode.value = 'list'
  } catch (error) {
    notifyError(error)
  } finally {
    bulkActionBusy.value = false
  }
}

const handleBulkClearTags = async () => {
  const notes = selectedNotesList.value
  if (!notes.length || bulkActionBusy.value) return

  bulkActionBusy.value = true
  bulkTagMenuOpen.value = false
  try {
    for (const note of notes) {
      await assistantStore.updateNote(note.id, '', getNoteContent(note), {
        tagId: null,
        tagName: '',
        retainedImageIds: getNoteRetainedImageIds(note),
      })
      applyTagFieldsToNote(note, { tagId: null, tagName: '' })
    }
    invalidateTagList()
    noteTagCloudRef.value?.reload?.()
    if (tagFilterState.active) {
      await reloadActiveTagFilter()
    }
    openToast(`已清空 ${notes.length} 条笔记的标签`, 'success', { duration: 1800 })
    exitNoteSelectingSession()
    noteViewMode.value = 'list'
  } catch (error) {
    notifyError(error)
  } finally {
    bulkActionBusy.value = false
  }
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
    } else if (dateFilterState.active) {
      loadMoreDateNotes()
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

const appendDateNotes = (list) => {
  const existing = new Set(dateFilterState.list.map((note) => note.id))
  const next = list.filter((note) => note?.id && !existing.has(note.id))
  if (!next.length) return
  dateFilterState.list = [...dateFilterState.list, ...next]
}

const clearDateFilter = () => {
  dateFilterToken += 1
  dateFilterState.active = false
  dateFilterState.dateKey = ''
  dateFilterState.label = ''
  dateFilterState.list = []
  dateFilterState.total = 0
  dateFilterState.loading = false
  dateFilterState.loadingMore = false
  dateFilterState.pageNo = 0
  dateFilterState.hasMore = false
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

const reloadActiveDateFilter = async ({ dateKey, label } = {}) => {
  const resolvedKey = dateKey ?? dateFilterState.dateKey
  if (!resolvedKey) return

  const myToken = ++dateFilterToken
  dateFilterState.active = true
  dateFilterState.dateKey = resolvedKey
  dateFilterState.label = label ?? formatDisplayDate(resolvedKey)
  dateFilterState.loading = true
  dateFilterState.loadingMore = false
  dateFilterState.list = []
  dateFilterState.total = 0
  dateFilterState.pageNo = 0
  dateFilterState.hasMore = false

  try {
    const result = await fetchBlockListByDate(resolvedKey, null, {
      pageNo: 1,
      pageSize: NOTE_LIST_PAGE_SIZE,
    })
    if (myToken !== dateFilterToken) {
      if (!dateFilterState.dateKey) dateFilterState.active = false
      return
    }
    dateFilterState.list = result.list
    dateFilterState.total = result.total
    dateFilterState.pageNo = result.pageNo
    dateFilterState.hasMore = result.hasMore
  } catch (error) {
    if (myToken !== dateFilterToken) {
      if (!dateFilterState.dateKey) dateFilterState.active = false
      return
    }
    dateFilterState.list = []
    dateFilterState.total = 0
    notifyError(error)
  } finally {
    if (myToken === dateFilterToken) dateFilterState.loading = false
  }
}

const loadMoreDateNotes = async () => {
  if (
    !dateFilterState.active ||
    !dateFilterState.hasMore ||
    dateFilterState.loading ||
    dateFilterState.loadingMore
  ) {
    return
  }

  const myToken = dateFilterToken
  dateFilterState.loadingMore = true
  try {
    const result = await fetchBlockListByDate(dateFilterState.dateKey, null, {
      pageNo: dateFilterState.pageNo + 1,
      pageSize: NOTE_LIST_PAGE_SIZE,
    })
    if (myToken !== dateFilterToken) return
    appendDateNotes(result.list)
    dateFilterState.pageNo = result.pageNo
    dateFilterState.hasMore = result.hasMore
  } catch (error) {
    if (myToken !== dateFilterToken) return
    notifyError(error)
  } finally {
    if (myToken === dateFilterToken) dateFilterState.loadingMore = false
  }
}

const openDayInList = async (dateKey) => {
  if (!dateKey) return
  clearTagFilter()
  clearSearch()
  activeTab.value = 'home'
  noteViewMode.value = 'list'
  await reloadActiveDateFilter({ dateKey, label: formatDisplayDate(dateKey) })
  await nextTick()
  scrollNoteListToTop()
}

const handleStatsOpenDay = (dateKey) => {
  void openDayInList(dateKey)
}

const handleHeatmapOpenDay = (dateKey) => {
  void openDayInList(dateKey)
}

const handleTagSelect = async (tag) => {
  noteViewMode.value = 'list'
  clearDateFilter()
  if (searchKeyword.value) clearSearch()

  const tagId = tag?.tagId
  const tagName = tag?.tagName || '未命名'
  if (!tagId) return

  await reloadActiveTagFilter({ tagId, tagName })
}

const reloadActiveTagFilter = async ({ tagId, tagName } = {}) => {
  const resolvedTagId = tagId ?? tagFilterState.tagId
  const resolvedTagName = tagName ?? tagFilterState.tagName
  if (!resolvedTagId) return

  const myToken = ++tagFilterToken
  tagFilterState.active = true
  tagFilterState.tagId = resolvedTagId
  tagFilterState.tagName = resolvedTagName
  tagFilterState.loading = true
  tagFilterState.loadingMore = false
  tagFilterState.list = []
  tagFilterState.total = 0
  tagFilterState.pageNo = 0
  tagFilterState.hasMore = false

  try {
    const result = await fetchNotesByTag(resolvedTagId, {
      pageNo: 1,
      pageSize: NOTE_LIST_PAGE_SIZE,
    })
    if (myToken !== tagFilterToken) {
      if (!tagFilterState.tagId) tagFilterState.active = false
      return
    }
    tagFilterState.list = result.list
    tagFilterState.total = result.total
    tagFilterState.pageNo = result.pageNo
    tagFilterState.hasMore = result.hasMore
  } catch (error) {
    if (myToken !== tagFilterToken) {
      if (!tagFilterState.tagId) tagFilterState.active = false
      return
    }
    const local = assistantStore.visibleNotes.filter((note) =>
      isUntaggedTag({ tagId: resolvedTagId })
        ? !note.tagId
        : (note.title || '') === resolvedTagName,
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

const patchNotesAfterTagDelete = (tagId) => {
  const deletedTagId = String(tagId ?? '')
  if (!deletedTagId) return
  for (const note of assistantStore.notes) {
    if (String(note?.tagId ?? '') === deletedTagId) {
      note.tagId = null
      note.title = ''
    }
  }
}

const flushNotesRefreshOnListEnter = async () => {
  if (!refreshNotesOnListEnter.value) return
  refreshNotesOnListEnter.value = false
  try {
    await assistantStore.loadInitialNotes()
    scrollNoteListToTop()
  } catch (error) {
    notifyError(error)
  }
}

const handleTagDeleted = async (tag) => {
  const deletedTagId = String(tag?.tagId ?? '')
  if (tagFilterState.active && String(tagFilterState.tagId) === deletedTagId) {
    clearTagFilter()
  } else if (tagFilterState.active && tagFilterState.list.length) {
    tagFilterState.list = tagFilterState.list.filter(
      (note) => String(note?.tagId ?? '') !== deletedTagId,
    )
    tagFilterState.total = tagFilterState.list.length
  }
  patchNotesAfterTagDelete(deletedTagId)
  refreshNotesOnListEnter.value = true
  if (noteViewMode.value === 'list' || noteViewMode.value === 'select') {
    await flushNotesRefreshOnListEnter()
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

const cancelPendingDelete = (id) => {
  if (!id) return
  const timer = deleteTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    deleteTimers.delete(id)
  }
  deleteSnapshots.delete(id)
  assistantStore.setNotePendingDelete(id, false)
}

const resetHomeListView = () => {
  tagFilterToken += 1
  clearTagFilter()
  clearSearch()
  noteViewMode.value = 'list'
}

const handleRecycleRestored = async (note) => {
  refreshNotesOnHomeEnter.value = false
  if (note?.recycleType === 'sediment') {
    activeTab.value = 'sediment'
    await nextTick()
    try {
      sedimentPanelRef.value?.reload?.()
      openToast('已恢复长文', 'success', { duration: 1600 })
    } catch (error) {
      notifyError(error)
    }
    return
  }
  if (note?.id) {
    cancelPendingDelete(note.id)
  }
  resetHomeListView()
  activeTab.value = 'home'
  await nextTick()
  try {
    await assistantStore.forceReloadNotes()
    scrollNoteListToTop()
    openToast('已恢复碎片', 'success', { duration: 1600 })
  } catch (error) {
    notifyError(error)
  }
}

const handleMovedToRecycle = async () => {
  trashPanelRef.value?.reload?.()
  if (activeTab.value === 'home') {
    try {
      await assistantStore.forceReloadNotes()
    } catch (error) {
      notifyError(error)
    }
  }
}

const handleBackupImported = async (payload) => {
  refreshNotesOnHomeEnter.value = true
  noteTagCloudRef.value?.reload?.()
  sedimentPanelRef.value?.reload?.()
  if (activeTab.value === 'home') {
    await flushHomeNotesRefresh()
  }
  const n = payload?.summary?.added ?? payload?.summary?.fragmentsAdded ?? 0
  openToast(payload?.type === 'markdown' ? `已导入 ${n} 条碎片` : '数据导入完成', 'success', { duration: 1800 })
}

const onTabChange = (tab) => {
  if (activeTab.value === tab) return
  activeTab.value = tab
}

const applyClipboardEnter = async (action) => {
  if (!isClipboardEnterAction(action)) return

  activeTab.value = 'home'
  await nextTick()

  if (action.type === 'over' && typeof action.payload === 'string') {
    const text = action.payload.trim()
    if (text) {
      inputValue.value = inputValue.value.trim()
        ? `${inputValue.value}\n${text}`
        : text
    }
  } else if (action.type === 'img') {
    if (shouldSkipClipboardEnterImage()) return
    if (isLocalImagePasteTargetActive()) return
    const file = await payloadToImageFile(action.payload)
    if (file) inputBarRef.value?.addImages([file])
  }

  await nextTick()
  inputBarRef.value?.focus()
}

let stopClipboardEnterListener = null
let stopSettingsNavigator = null

const scrollSettingsToTarget = async (target) => {
  if (!target) return
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await nextTick()
    if (settingsPanelRef.value?.scrollToTarget?.(target)) return
    await new Promise((resolve) => window.setTimeout(resolve, 60))
  }
}

const scrollToNote = async (id) => {
  const tryScroll = () => {
    const el = document.querySelector(`[data-note-id="${id}"]`)
    if (!el) return false
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  }
  if (tryScroll()) return
  const exists = assistantStore.notes.some((note) => note.id === id)
  if (!exists) {
    await assistantStore.reloadNotes()
    await nextTick()
  }
  tryScroll()
}

const handleGlobalSearchSelect = async (item) => {
  if (!item?.id) return
  if (item.type === 'sediment') {
    activeTab.value = 'sediment'
    await nextTick()
    sedimentPanelRef.value?.openNoteViewByNoteId(item.noteId || item.id, item.title)
    return
  }
  activeTab.value = 'home'
  clearTagFilter()
  clearSearch()
  noteViewMode.value = 'list'
  await nextTick()
  await scrollToNote(item.id)
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
  toastDismissMode,
  closeToast,
  openToast,
  triggerToastAction,
} = useCopyNote()

const deleteTimers = new Map()
const deleteSnapshots = new Map()

const handleAutoTagEnabled = () => {
  pendingAutoTagSetup.value = false
  openToast('已开启 AI 自动打标签', 'success', { duration: 2000 })
}

const handleSubmit = async ({ text, images, tagId, tagName }) => {
  if (noteSubmitting.value) return

  const aiSettings = loadAiSettings()
  const hasManualTag = tagId || String(tagName || '').trim()
  const shouldResolveTag =
    isUtoolsMode() &&
    aiSettings.autoTagEnabled &&
    !hasManualTag &&
    shouldAutoTagContent(text)

  if (
    isUtoolsMode() &&
    !hasManualTag &&
    text.trim() &&
    !aiSettings.autoTagEnabled
  ) {
    openToast('开启 AI 自动打标签，省时省力！', 'success', {
      dismissMode: 'manual',
      actionLabel: '去开启',
      onAction: () => {
        pendingAutoTagSetup.value = true
        activeTab.value = 'settings'
      },
    })
  }

  const isListPanelVisible =
    noteViewMode.value === 'list'
    || noteViewMode.value === 'select'
    || noteViewMode.value === 'selected'
  if (!isListPanelVisible) {
    noteViewMode.value = 'list'
    await nextTick()
    scrollNoteListToTop()
  }

  noteSubmitting.value = true
  uploadProgress.value = 0
  try {
    const note = await assistantStore.addNote(
      text,
      images,
      (p) => {
        uploadProgress.value = p
      },
      {
        tagId,
        tagName,
        resolveTagName: shouldResolveTag ? generateNoteTitle : undefined,
      },
    )
    appendNoteToTagFilter(note)
    appendNoteToDateFilter(note)
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
  openToast(`最多支持 ${max} 个附件`, 'error', { duration: 1800 })
}

const handleImageTooLarge = () => {
  openToast('单张图片须小于 10 MB', 'error', { duration: 2200 })
}

const handleFileTooLarge = () => {
  openToast('单个附件须小于 10 MB', 'error', { duration: 2200 })
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
    if (tagFilterState.active) {
      await reloadActiveTagFilter()
    }
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
  stashAndRemoveFromFilterLists(id)

  const timer = window.setTimeout(async () => {
    deleteTimers.delete(id)
    try {
      await deleteBlock(id)
      deleteSnapshots.delete(id)
      removeNotesFromHomeLists([id])
      trashPanelRef.value?.reload()
    } catch (error) {
      assistantStore.setNotePendingDelete(id, false)
      restoreFromDeleteSnapshot(id)
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
  restoreFromDeleteSnapshot(id)
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

const handleCopied = (payload) => {
  const mode = payload?.mode || 'plain'
  const messages = {
    plain: '已复制纯文本',
    rich: payload?.imageCount
      ? `已复制（含 ${payload.imageCount} 张图片）`
      : '已复制（含图片）',
  }
  openToast(messages[mode] || '复制成功', 'success', { duration: 1600 })
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
    if (count === 0) {
      bulkTagMenuOpen.value = false
      if (noteViewMode.value === 'selected') {
        noteViewMode.value = noteSelectingActive.value ? 'select' : 'list'
      }
    }
  },
)

onMounted(async () => {
  stopClipboardEnterListener = onClipboardEnter((action) => {
    takePendingClipboardAction()
    applyClipboardEnter(action)
  })
  stopSettingsNavigator = registerSettingsNavigator(async (target) => {
    sedimentPanelRef.value?.dismissOverlays?.()
    activeTab.value = 'settings'
    await scrollSettingsToTarget(target)
  })

  try {
    await assistantStore.loadInitialNotes()
  } catch (error) {
    notifyError(error)
  }
  await nextTick()
  inputBarRef.value?.focus()
})

onBeforeUnmount(() => {
  stopClipboardEnterListener?.()
  stopClipboardEnterListener = null
  stopSettingsNavigator?.()
  stopSettingsNavigator = null
  deleteTimers.forEach((timer) => clearTimeout(timer))
  deleteTimers.clear()
  deleteSnapshots.clear()
  bulkAiTagWorkerToken += 1
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
