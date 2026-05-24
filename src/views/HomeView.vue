<template>
  <MainFrame :show-input-area="activeTab === 'home'">
    <template #sidebar>
      <SidePanel
        :active-tab="activeTab"
        :trash-count="recycleCount"
        @tab-change="onTabChange"
      />
    </template>

    <template #input>
      <FloatingInputBar
        ref="inputBarRef"
        v-model="inputValue"
        :submitting="noteSubmitting"
        :upload-progress="uploadProgress"
        :search-loading="searchState.loading"
        @submit="handleSubmit"
        @limit-exceeded="handleLimitExceeded"
        @image-too-large="handleImageTooLarge"
        @search="handleSearch"
        @search-cancel="handleSearchCancel"
      />
    </template>

    <template #content>
      <!-- 主页：v-show 保活 DOM，避免切回时重挂载阻塞侧栏选中态 -->
      <div v-show="activeTab === 'home'" class="tab-panel tab-panel--home">
        <section v-show="!searchState.active" class="note-list">
          <p
            v-if="!assistantStore.visibleNotes.length && !assistantStore.loadingNotes"
            class="empty-state"
          >
            还没有笔记，先记录一条吧。
          </p>

          <NoteCard
            v-for="note in assistantStore.visibleNotes"
            :key="note.id"
            :note="note"
            @edit-save="handleEditSave"
            @delete="handleDelete"
            @copied="handleCopied"
            @copy-failed="handleCopyFailed"
            @pin="handlePin"
            @image-too-large="handleImageTooLarge"
          />
        </section>

        <section v-if="searchState.active" class="note-list">
          <header class="search-summary">
            <span class="search-summary-label">
              搜索结果
              <span class="search-summary-keyword">「{{ searchState.keyword }}」</span>
            </span>
            <span class="search-summary-count">
              <template v-if="searchState.loading">搜索中…</template>
              <template v-else>共 {{ searchState.total }} 条</template>
            </span>
            <motion.button
              type="button"
              class="search-summary-clear"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="exitSearch"
            >
              清空
            </motion.button>
          </header>

          <p
            v-if="!searchState.loading && !searchState.list.length"
            class="empty-state"
          >
            没有匹配 「{{ searchState.keyword }}」 的笔记。
          </p>

          <NoteCard
            v-for="note in searchState.list"
            :key="`search-${note.id}`"
            :note="note"
            :highlight="searchState.keyword"
            :plain="true"
            @edit-save="handleEditSave"
            @delete="handleDelete"
            @copied="handleCopied"
            @copy-failed="handleCopyFailed"
            @pin="handlePin"
            @image-too-large="handleImageTooLarge"
          />
        </section>
      </div>

      <!-- 沉淀 -->
      <SedimentPanel v-show="activeTab === 'sediment'" />

      <!-- 回响 -->
      <section v-show="activeTab === 'echo'" class="note-list placeholder-panel">
        <div class="placeholder-card">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 12a8 8 0 0 1 16 0" />
            <path d="M7 12a5 5 0 0 1 10 0" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <h2 class="placeholder-title">回响</h2>
          <p class="placeholder-desc">回顾与联想会汇聚于此，功能即将上线。</p>
        </div>
      </section>

      <!-- 回收站 -->
      <TrashPanel
        v-show="activeTab === 'trash'"
        :active="activeTab === 'trash'"
        @count-change="recycleCount = $event"
        @restored="handleRecycleRestored"
        @error="notifyError"
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
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { motion } from 'motion-v'
import CopyToast from '../components/feedback/CopyToast.vue'
import { useMotionPresets } from '../composables/useMotionPresets'
import FloatingInputBar from '../components/input/FloatingInputBar.vue'
import MainFrame from '../components/layout/MainFrame.vue'
import SedimentPanel from '../components/sediment/SedimentPanel.vue'
import TrashPanel from '../components/trash/TrashPanel.vue'
import SidePanel from '../components/layout/SidePanel.vue'
import NoteCard from '../components/note/NoteCard.vue'
import { useCopyNote } from '../composables/useCopyNote'
import { ApiError } from '../api/http'
import { deleteBlock, fetchRecycleList, searchNotes } from '../api/note'
import { useAssistantStore } from '../stores/assistantStore'

const { presets } = useMotionPresets()

const inputValue = ref('')
const noteSubmitting = ref(false)
const uploadProgress = ref(0)
const inputBarRef = ref(null)
const assistantStore = useAssistantStore()

const activeTab = ref('home')
const recycleCount = ref(0)

const refreshRecycleCount = async () => {
  try {
    const list = await fetchRecycleList()
    recycleCount.value = list.length
  } catch {
    recycleCount.value = 0
  }
}

const handleRecycleRestored = async () => {
  try {
    await assistantStore.loadInitialNotes()
    openToast('已恢复笔记', 'success', { duration: 1600 })
  } catch (error) {
    notifyError(error)
  }
}

const onTabChange = (tab) => {
  if (activeTab.value === tab) return
  activeTab.value = tab
  if (tab !== 'home' && searchState.active) {
    nextTick(() => exitSearch())
  }
}

const searchState = reactive({
  active: false,
  loading: false,
  keyword: '',
  total: 0,
  list: [],
})
let searchToken = 0
const {
  showToast,
  toastText,
  toastType,
  toastActionLabel,
  openToast,
  triggerToastAction,
} = useCopyNote()

const deleteTimers = new Map()

const handleSubmit = async ({ text, images }) => {
  if (noteSubmitting.value) return
  noteSubmitting.value = true
  uploadProgress.value = 0
  try {
    await assistantStore.addNote(text, images, (p) => {
      uploadProgress.value = p
    })
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

const handleSearch = async ({ keyword }) => {
  const trimmed = (keyword || '').trim()
  if (!trimmed) return
  const myToken = ++searchToken
  searchState.active = true
  searchState.keyword = trimmed
  searchState.loading = true
  try {
    const result = await searchNotes({ keyword: trimmed, page: 1, size: 20 })
    if (myToken !== searchToken) return
    searchState.total = result.total
    searchState.list = result.list
  } catch (error) {
    if (myToken !== searchToken) return
    searchState.list = []
    searchState.total = 0
    notifyError(error)
  } finally {
    if (myToken === searchToken) {
      searchState.loading = false
    }
  }
}

const handleSearchCancel = () => {
  searchToken += 1
  searchState.active = false
  searchState.loading = false
  searchState.keyword = ''
  searchState.total = 0
  searchState.list = []
}

const exitSearch = () => {
  handleSearchCancel()
  inputBarRef.value?.exitSearchMode?.()
}

const handleEditSave = async ({
  id,
  title,
  content,
  retainedImageIds,
  newImages,
}) => {
  try {
    await assistantStore.updateNote(id, title, content, {
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
      await refreshRecycleCount()
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

onMounted(async () => {
  try {
    await assistantStore.loadInitialNotes()
    await refreshRecycleCount()
  } catch (error) {
    notifyError(error)
  }
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
  overflow: hidden;
}

.note-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 0 28px;
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

.search-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: var(--radius-md);
  background: rgba(24, 24, 27, 0.04);
  color: var(--color-secondary-text);
  font-size: 13px;
}

.search-summary-label {
  font-weight: 500;
  color: var(--color-primary);
}

.search-summary-keyword {
  color: var(--color-text);
  font-weight: 600;
}

.search-summary-count {
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.search-summary-clear {
  border: 0;
  background: transparent;
  color: var(--color-secondary-text);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.search-summary-clear:hover {
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
