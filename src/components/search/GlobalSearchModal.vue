<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="global-search-modal"
        class="global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        :initial="modalMotion.initial"
        :animate="modalMotion.animate"
        :exit="modalMotion.exit"
        :transition="modalMotion.transition"
      >
        <div class="global-search-body">
          <div class="global-search-toolbar">
            <motion.button
              type="button"
              class="global-search-close"
              aria-label="关闭搜索"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emitClose"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </motion.button>

            <div class="global-search-toolbar-main">
              <GlobalSearchQueryBar
                ref="queryBarRef"
                :active="visible"
                compact
                clear-on-inactive
                :scopes="resolvedScopes"
              />
            </div>
          </div>

          <div class="global-search-filters">
            <div class="global-search-scope" role="tablist" aria-label="搜索范围">
              <button
                v-for="item in scopeOptions"
                :key="item.id"
                type="button"
                class="global-search-scope-btn"
                :class="{ 'is-active': scope === item.id }"
                role="tab"
                :aria-selected="scope === item.id"
                @click="scope = item.id"
              >
                <motion.span
                  v-if="scope === item.id"
                  layout-id="globalSearchScope"
                  class="global-search-scope-active-bg"
                  :transition="presets.layoutSpring"
                />
                <span class="global-search-scope-label">{{ item.label }}</span>
              </button>
            </div>
            <span class="global-search-results-count">
              <template v-if="loading">搜索中…</template>
              <template v-else-if="hasQueried">共 {{ total }} 条</template>
            </span>
          </div>

          <div
            ref="resultsRef"
            class="global-search-results"
            @scroll="onResultsScroll"
          >
            <p v-if="searchError" class="global-search-state global-search-state--error">
              {{ searchError }}
            </p>
            <p
              v-else-if="hasQueried && !loading && !results.length"
              class="global-search-state"
            >
              未找到匹配内容，试试减少关键词或放宽筛选
            </p>

            <template v-for="item in results" :key="`${item.type}-${item.id}`">
              <NoteCard
                v-if="item.type === 'fragment'"
                class="global-search-fragment-card"
                :note="fragmentResultToNote(item)"
                :highlight="highlightKeywords"
                :show-pin-actions="false"
                @edit-save="handleFragmentEditSave"
                @delete="handleFragmentDelete"
                @copied="handleCopied"
                @copy-failed="handleCopyFailed"
                @image-too-large="handleAttachmentTooLarge('image')"
                @file-too-large="handleAttachmentTooLarge('file')"
                @error="notifyFragmentError"
                @tag-select="handleFragmentTagSelect"
              />

              <!-- 沉淀：摘要 + 点击打开详情 -->
              <article
                v-else-if="item.type === 'sediment'"
                class="global-search-result is-sediment"
                role="button"
                tabindex="0"
                @click="openSedimentDetail(item)"
                @keydown.enter.prevent="openSedimentDetail(item)"
              >
                <div class="global-search-result-meta">
                  <div class="global-search-result-meta-left">
                    <span class="global-search-result-icon is-sediment" title="沉淀" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2 2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </span>
                    <span v-if="item.title" class="global-search-result-tag">
                      {{ item.title }}
                    </span>
                  </div>
                  <span v-if="item.createTime" class="global-search-result-time">
                    {{ formatTime(item.createTime) }}
                  </span>
                </div>
                <div
                  v-if="resultSnippets(item).length"
                  class="global-search-result-snippets"
                >
                  <p
                    v-for="(snippet, snippetIndex) in resultSnippets(item)"
                    :key="`${item.id}-${snippetIndex}`"
                    class="global-search-result-snippet"
                    v-html="highlightText(snippet)"
                  />
                </div>
                <div
                  v-if="resultImages(item).length || resultFiles(item).length"
                  class="global-search-result-attachments"
                  @click.stop
                >
                  <NoteImageGallery
                    v-if="resultImages(item).length"
                    :images="resultImages(item)"
                  />
                  <NoteFileList
                    v-if="resultFiles(item).length"
                    :attachments="resultFiles(item)"
                    compact
                  />
                </div>
              </article>

              <!-- 待办：摘要 + 点击跳转事情详情 -->
              <article
                v-else-if="item.type === 'todo'"
                class="global-search-result is-todo"
                role="button"
                tabindex="0"
                @click="openTodoDetail(item)"
                @keydown.enter.prevent="openTodoDetail(item)"
              >
                <div class="global-search-result-meta">
                  <div class="global-search-result-meta-left">
                    <span class="global-search-result-icon is-todo" title="待办" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </span>
                    <span v-if="item.projectName" class="global-search-result-tag">
                      {{ item.projectName }}
                    </span>
                  </div>
                  <span v-if="item.createTime" class="global-search-result-time">
                    {{ formatTime(item.createTime) }}
                  </span>
                </div>
                <div
                  v-if="item.title"
                  class="global-search-result-title"
                  v-html="highlightText(item.title)"
                />
                <div
                  v-if="todoDoneWhenSummary(item)"
                  class="global-search-result-snippets"
                >
                  <p
                    class="global-search-result-snippet"
                    v-html="highlightText(todoDoneWhenSummary(item))"
                  />
                </div>
              </article>
            </template>

            <p v-if="loadingMore" class="global-search-state">加载更多…</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>

  <StructNoteViewModal
    :visible="sedimentVisible"
    :note-item="sedimentNoteItem"
    elevated
    @close="closeSedimentDetail"
    @error="onSedimentError"
  />

  <CopyToast
    :visible="showToast"
    :text="toastText"
    :type="toastType"
    @close="closeToast"
  />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useCopyNote } from '../../composables/useCopyNote'
import { highlightPlainText } from '../../utils/searchHighlight'
import { getAttachmentKind } from '../../utils/attachmentDisplay'
import { findStructFolderItemByNoteId } from '../../api/structNote'
import { deleteBlock } from '../../api/note'
import { ApiError } from '../../api/http'
import { useAssistantStore } from '../../stores/assistantStore'
import CopyToast from '../feedback/CopyToast.vue'
import NoteCard from '../note/NoteCard.vue'
import NoteFileList from '../note/NoteFileList.vue'
import NoteImageGallery from '../note/NoteImageGallery.vue'
import StructNoteViewModal from '../sediment/StructNoteViewModal.vue'
import GlobalSearchQueryBar from './GlobalSearchQueryBar.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'open-todo'])

const { presets, reduced } = useMotionPresets()
const {
  showToast,
  toastText,
  toastType,
  closeToast,
  openToast,
} = useCopyNote()
const assistantStore = useAssistantStore()

const scopeOptions = [
  { id: 'all', label: '全部' },
  { id: 'fragment', label: '碎片' },
  { id: 'sediment', label: '沉淀' },
  { id: 'todo', label: '待办' },
]

const scope = ref('all')
const queryBarRef = ref(null)
const resultsRef = ref(null)
const highlightKeywords = ref([])

const sedimentVisible = ref(false)
const sedimentNoteItem = ref(null)

const query = computed(() => queryBarRef.value?.query ?? null)
const results = computed(() => query.value?.results.value ?? [])
const total = computed(() => query.value?.total.value ?? 0)
const loading = computed(() => query.value?.loading.value ?? false)
const loadingMore = computed(() => query.value?.loadingMore.value ?? false)
const searchError = computed(() => query.value?.searchError.value ?? '')
const hasQueried = computed(() => query.value?.hasQueried.value ?? false)

const modalEase = [0.22, 1, 0.36, 1]

const modalMotion = computed(() => {
  if (reduced.value) {
    return { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
  }
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
    transition: { duration: 0.24, ease: modalEase },
  }
})

const resolvedScopes = computed(() => {
  if (scope.value === 'fragment') return ['fragment']
  if (scope.value === 'sediment') return ['sediment']
  if (scope.value === 'todo') return ['todo']
  return ['fragment', 'sediment', 'todo']
})

const formatTime = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const fragmentResultToNote = (item) => {
  if (!item?.id) {
    return {
      id: '',
      title: '',
      markdownContent: '',
      createdAt: '',
      attachments: [],
    }
  }
  const attachments = Array.isArray(item.attachments) ? item.attachments : []
  return {
    id: item.id,
    title: item.tagName || item.title || '',
    tagId: item.tagId ?? null,
    createdAt: item.createTime || '',
    markdownContent: item.markdownContent || item.content || '',
    text: item.content || '',
    attachments,
    images: attachments.filter((att) => getAttachmentKind(att) === 'image'),
    pinWeightType: item.pinWeightType || 'DEFAULT',
    aiNoteRecallId: item.aiNoteRecallId ?? null,
  }
}

const refreshSearchResults = async () => {
  try {
    await query.value?.runSearch?.({ reset: true })
  } catch (error) {
    console.error('[烂笔头] 全局搜索刷新失败', error)
  }
}

const notifyFragmentError = (error) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '操作失败，请稍后重试'
  openToast(message, 'error', { duration: 2200 })
}

const handleFragmentEditSave = async ({
  id,
  title,
  content,
  tagId,
  tagName,
  retainedImageIds,
  newImages,
}) => {
  if (!id) {
    notifyFragmentError('无法保存：缺少笔记 ID')
    throw new Error('missing note id')
  }
  try {
    await assistantStore.updateNote(id, title, content, {
      tagId,
      tagName,
      retainedImageIds,
      newImages,
    })
    openToast('已保存修改', 'success')
    await refreshSearchResults()
  } catch (error) {
    notifyFragmentError(error instanceof ApiError ? `[${error.code}] ${error.msg}` : error)
    throw error
  }
}

const handleFragmentDelete = async ({ id }) => {
  if (!id) {
    notifyFragmentError('无法删除：缺少笔记 ID')
    return
  }
  try {
    if (assistantStore.editingNoteId === id) {
      assistantStore.setEditingNoteId(null)
    }
    await deleteBlock(id)
    openToast('笔记已删除', 'success')
    await refreshSearchResults()
  } catch (error) {
    notifyFragmentError(error instanceof ApiError ? `[${error.code}] ${error.msg}` : error)
  }
}

const handleCopied = (payload) => {
  const mode = payload?.mode || 'plain'
  const messages = {
    plain: '已复制纯文本',
    rich: payload?.imageCount
      ? `已复制（含 ${payload.imageCount} 张图片）`
      : '已复制（含图片）',
    'share-copy': '分享图已复制',
    'share-save': '分享图已保存',
  }
  openToast(messages[mode] || '复制成功', 'success', { duration: 1600 })
}

const handleCopyFailed = () => {
  openToast('复制失败', 'error', { duration: 1600 })
}

const handleAttachmentTooLarge = (kind) => {
  openToast(
    kind === 'file' ? '单个附件须小于 10 MB' : '单张图片须小于 10 MB',
    'error',
    { duration: 2200 },
  )
}

const handleFragmentTagSelect = ({ tagId, tagName }) => {
  if (!tagId || !tagName || !query.value?.selectedTag) return
  query.value.selectedTag.value = { tagId, tagName }
  query.value.scheduleSearch?.(true)
}

const resultSnippets = (item) => {
  if (Array.isArray(item.snippets) && item.snippets.length) return item.snippets
  if (item.snippet) return [item.snippet]
  return []
}

const todoDoneWhenSummary = (item) => {
  const doneWhen = String(item?.doneWhen || '').trim()
  if (doneWhen) return doneWhen
  const snippets = resultSnippets(item).filter((snippet) => snippet !== item?.title)
  return snippets[0] || ''
}

const resultAttachments = (item) =>
  Array.isArray(item?.attachments) ? item.attachments : []

const resultImages = (item) =>
  resultAttachments(item).filter((att) => getAttachmentKind(att) === 'image')

const resultFiles = (item) =>
  resultAttachments(item).filter((att) => getAttachmentKind(att) === 'file')

const highlightText = (text) => highlightPlainText(text, highlightKeywords.value)

const syncHighlightKeywords = () => {
  const list = queryBarRef.value?.query?.keywords?.value
  highlightKeywords.value = Array.isArray(list) ? [...list] : []
}

const closeSedimentDetail = () => {
  sedimentVisible.value = false
  sedimentNoteItem.value = null
}

const openSedimentDetail = async (item) => {
  if (!item?.id) return
  const noteId = item.noteId || item.id
  const title = item.title || '无标题'
  try {
    const folderItem = await findStructFolderItemByNoteId(noteId)
    sedimentNoteItem.value = folderItem || {
      type: 'note',
      id: noteId,
      noteId,
      name: title,
    }
  } catch {
    sedimentNoteItem.value = {
      type: 'note',
      id: noteId,
      noteId,
      name: title,
    }
  }
  sedimentVisible.value = true
}

const onSedimentError = (error) => {
  console.error('[烂笔头] 全局搜索打开沉淀失败', error)
}

const openTodoDetail = (item) => {
  const projectId = String(item?.projectId || '').trim()
  const todoId = String(item?.id || item?.todoId || '').trim()
  if (!projectId || !todoId) return
  emit('open-todo', {
    projectId,
    todoId,
    projectName: item?.projectName || '',
  })
  emit('close')
}

const emitClose = () => {
  if (loading.value || loadingMore.value) return
  if (sedimentVisible.value) return
  emit('close')
}

const onResultsScroll = () => {
  query.value?.loadMoreIfNearBottom(resultsRef.value)
}

const onKeydown = (event) => {
  if (!props.visible || loading.value) return
  if (sedimentVisible.value) return
  if (event.key !== 'Escape') return
  event.preventDefault()
  emit('close')
}

watch(
  () => queryBarRef.value?.query?.keywords?.value,
  () => syncHighlightKeywords(),
  { deep: true },
)

watch(
  results,
  () => syncHighlightKeywords(),
)

watch(
  () => props.visible,
  (open) => {
    if (open) {
      scope.value = 'all'
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
      closeSedimentDetail()
      highlightKeywords.value = []
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

const applySearchText = async (text) => {
  await nextTick()
  queryBarRef.value?.applySearchText?.(text)
  await nextTick()
  syncHighlightKeywords()
}

defineExpose({
  applySearchText,
  focus: () => queryBarRef.value?.focus?.(),
})
</script>

<style scoped>
.global-search-modal {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.global-search-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(960px, calc(100% - 32px));
  margin: 0 auto;
  padding: 12px 20px 16px;
  gap: 10px;
  box-sizing: border-box;
}

.global-search-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.global-search-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
  cursor: pointer;
  flex-shrink: 0;
  box-sizing: border-box;
}

.global-search-close:hover {
  background: rgba(24, 24, 27, 0.1);
  color: var(--color-text);
}

.global-search-toolbar-main {
  flex: 1;
  min-width: 0;
}

.global-search-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 14px;
  flex-shrink: 0;
}

.global-search-scope {
  display: inline-flex;
  flex-wrap: wrap;
  padding: 3px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.05);
  gap: 2px;
}

.global-search-scope-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  z-index: 0;
}

.global-search-scope-btn.is-active {
  color: var(--color-primary);
  font-weight: 600;
}

.global-search-scope-active-bg {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.08);
  z-index: -1;
}

.global-search-scope-label {
  position: relative;
  z-index: 1;
}

.global-search-results-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.global-search-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.global-search-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: left;
  color: inherit;
  font: inherit;
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.global-search-result.is-sediment {
  cursor: pointer;
}

.global-search-result.is-todo {
  cursor: pointer;
}

.global-search-result.is-fragment {
  cursor: default;
}

.global-search-fragment-card {
  width: 100%;
}

.global-search-result:hover {
  border-color: rgba(24, 24, 27, 0.18);
  box-shadow: var(--shadow-card);
}

.global-search-result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.global-search-result-meta-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.global-search-result-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--color-secondary-text);
}

.global-search-result-icon.is-fragment {
  color: var(--color-accent);
}

.global-search-result-icon.is-sediment {
  color: #7c3aed;
}

.global-search-result-icon.is-todo {
  color: #059669;
}

.global-search-result-tag {
  display: inline-block;
  max-width: 220px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.global-search-result-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--color-text);
  word-break: break-word;
}

.global-search-result-title :deep(mark.note-highlight) {
  background: rgba(37, 99, 235, 0.16);
  color: var(--color-accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
  margin: 0 -1px;
}

.global-search-result-full {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.global-search-result-full :deep(mark.note-highlight),
.global-search-result-snippet :deep(mark.note-highlight) {
  background: rgba(37, 99, 235, 0.16);
  color: var(--color-accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
  margin: 0 -1px;
}

.global-search-result-snippets {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.global-search-result-attachments {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.global-search-result-attachments :deep(.gallery),
.global-search-result-attachments :deep(.file-list) {
  margin-top: 0;
}

.global-search-result-attachments :deep(.tile) {
  width: 72px;
  height: 72px;
}

.global-search-result-snippet {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.03);
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.global-search-result-time {
  flex: 0 0 auto;
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.global-search-state {
  margin: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.global-search-state--error {
  color: var(--color-error);
}

@media (max-width: 720px) {
  .global-search-body {
    width: calc(100% - 24px);
    padding: 10px 12px 14px;
  }

  .global-search-filters {
    gap: 8px;
  }

  .global-search-scope {
    width: 100%;
    justify-content: space-between;
  }

  .global-search-scope-btn {
    flex: 1;
    padding: 0 8px;
  }

  .global-search-results-count {
    width: 100%;
    text-align: right;
  }
}
</style>
