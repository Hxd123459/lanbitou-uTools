<template>
  <AnimatePresence>
    <motion.aside
      v-if="open"
      key="fragments-panel"
      class="struct-note-fragments"
      aria-label="碎片面板"
      :initial="{ width: 0, opacity: 0, x: 16 }"
      :animate="{ width: panelWidthPx, opacity: 1, x: 0 }"
      :exit="{ width: 0, opacity: 0, x: 16 }"
      :transition="panelMotionTransition"
    >
      <div class="struct-note-fragments-inner">
        <div class="struct-note-fragments-head">
          <div v-if="showFragmentTabs" ref="tabsRef" class="struct-note-fragments-tabs" role="tablist" aria-label="碎片视图">
            <motion.div
              class="struct-note-fragments-tab-indicator"
              :animate="tabIndicator"
              :transition="{ type: 'spring', stiffness: 420, damping: 34 }"
            />
            <button
              ref="allTabRef"
              type="button"
              class="struct-note-fragments-tab"
              role="tab"
              :aria-selected="panelTab === 'all'"
              @click="setPanelTab('all')"
            >
              全部
            </button>
            <button
              ref="selectedTabRef"
              type="button"
              class="struct-note-fragments-tab"
              role="tab"
              :aria-selected="panelTab === 'selected'"
              @click="setPanelTab('selected')"
            >
              已选({{ fragmentNotes.length }})
            </button>
          </div>
          <h3 v-else class="struct-note-fragments-title">
            来源({{ fragmentNotes.length }})
          </h3>

          <div class="struct-note-fragments-head-actions">
            <StructNoteFragmentAiPicker
              v-if="showFragmentTabs && panelTab === 'selected' && fragmentNotes.length"
              :model-value="selectedInsertPreset"
              :disabled="disabled"
              :processing="aiProcessing"
              @update:model-value="emit('update:selectedInsertPreset', $event)"
            />
            <button
              v-if="showFragmentTabs && panelTab === 'selected' && fragmentNotes.length"
              type="button"
              class="struct-note-fragments-insert-all"
              :class="{ 'is-stop': aiProcessing }"
              :disabled="disabled || (!aiProcessing && allFragmentsInserted)"
              @click="aiProcessing ? emit('stop-ai') : emit('insert-all')"
            >
              {{ aiProcessing ? '停止' : '全部插入' }}
            </button>
            <motion.button
              type="button"
              class="struct-note-fragments-action"
              aria-label="收起碎片面板"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emit('update:open', false)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </motion.button>
          </div>
        </div>

        <div
          v-if="showFragmentTabs"
          v-show="panelTab === 'all'"
          class="struct-note-fragments-all-pane"
        >
          <GlobalSearchQueryBar
            ref="queryBarRef"
            compact
            panel-mode
            :active="open && panelTab === 'all'"
            :scopes="fragmentOnlyScopes"
            query-without-filters
            placeholder="使用 # 选标签；Enter 添加关键词"
            class="struct-note-fragments-search"
            @results-change="onSearchResultsChange"
          />

          <div
            ref="allListRef"
            class="struct-note-fragments-all-list"
            @scroll="onAllListScroll"
          >
            <p v-if="pickerLoading && !pickerList.length" class="struct-note-fragments-empty">
              加载中…
            </p>
            <p v-else-if="searchError" class="struct-note-fragments-empty struct-note-fragments-empty--error">
              {{ searchError }}
            </p>
            <p v-else-if="hasQueried && !pickerLoading && !visiblePickerList.length && pickerList.length" class="struct-note-fragments-empty">
              匹配碎片均已引入正文
            </p>
            <p v-else-if="hasQueried && !pickerLoading && !pickerList.length" class="struct-note-fragments-empty">
              未找到匹配碎片，试试减少关键词或放宽筛选
            </p>

            <div
              v-for="note in visiblePickerList"
              :key="note.id"
              class="struct-note-fragments-all-item"
            >
              <NoteCard
                :note="note"
                :highlight="searchKeywords"
                selectable
                compact
                disable-edit
                :selected="isNoteSelected(note.id)"
                @toggle-select="toggleAllTabSelect(note)"
              />
            </div>

            <p v-if="pickerLoadingMore" class="struct-note-fragments-empty struct-note-fragments-empty--more">
              加载更多…
            </p>
          </div>
        </div>

        <p
          v-if="mode === 'compose' && showFragmentTabs && panelTab === 'selected' && fragmentNotes.length"
          class="struct-note-fragments-summary"
        >
          <svg
            class="struct-note-fragments-summary-icon"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>将由 {{ fragmentNotes.length }} 条碎片沉淀 · 保存后移出碎片列表</span>
        </p>

        <!-- 已选 Tab -->
        <div
          v-show="panelTab === 'selected' || (mode === 'source' && !showFragmentTabs)"
          class="struct-note-fragments-selected-pane"
        >
          <p v-if="!fragmentNotes.length" class="struct-note-fragments-empty">
            {{ emptyText }}
          </p>

          <ul v-else ref="listRef" class="struct-note-fragments-list">
              <li
                v-for="note in sortedFragmentNotes"
                :key="note.id"
                class="struct-note-fragment-item"
                :class="{
                  'is-restoring': restoringConfirmId === String(note.id),
                }"
              >
                <div class="struct-note-fragment-meta">
                  <span v-if="(note.title || '').trim()" class="struct-note-fragment-tag">
                    {{ note.title }}
                  </span>
                  <time class="struct-note-fragment-time">{{ formatFragmentTime(note.createdAt) }}</time>
                </div>
                <div class="struct-note-fragment-main">
                  <div class="struct-note-fragment-content">
                    <TiptapPreview
                      v-if="getFragmentContent(note)"
                      :content="getFragmentContent(note)"
                      :show-fallback="false"
                    />
                    <p v-else-if="!getFragmentAttachments(note).length" class="struct-note-fragment-empty">（暂无内容）</p>
                    <NoteImageGallery
                      v-if="getFragmentImages(note).length"
                      :images="getFragmentImages(note)"
                    />
                    <NoteFileList
                      v-if="getFragmentFiles(note).length"
                      :attachments="getFragmentFiles(note)"
                      compact
                    />
                  </div>
                </div>

                <div
                  v-if="restoringConfirmId === String(note.id)"
                  class="fragment-restore-confirm"
                  @click.stop
                >
                  <span class="fragment-restore-text">还原至碎片列表？</span>
                  <div class="fragment-restore-actions">
                    <motion.button
                      type="button"
                      class="fragment-restore-btn fragment-restore-btn--yes"
                      :disabled="disabled || restoringId === note.id"
                      :while-hover="presets.button.hover"
                      :while-tap="presets.button.tap"
                      :transition="presets.button.transition"
                      @click="confirmRestore(note)"
                    >
                      {{ restoringId === note.id ? '还原中…' : '还原' }}
                    </motion.button>
                    <motion.button
                      type="button"
                      class="fragment-restore-btn fragment-restore-btn--no"
                      :disabled="restoringId === note.id"
                      :while-hover="presets.button.hover"
                      :while-tap="presets.button.tap"
                      :transition="presets.button.transition"
                      @click="cancelRestoreConfirm"
                    >
                      取消
                    </motion.button>
                  </div>
                </div>

                <div v-else class="struct-note-fragment-footer">
                  <motion.button
                    type="button"
                    class="fragment-item-action-btn"
                    :class="{ 'is-added': isFragmentInserted(note.id) }"
                    :disabled="disabled || isFragmentInserted(note.id) || aiProcessing"
                    :aria-label="isFragmentInserted(note.id) ? '已引入正文' : '引入正文'"
                    :title="isFragmentInserted(note.id) ? '已引入正文' : '引入正文'"
                    :while-hover="disabled || isFragmentInserted(note.id) ? undefined : presets.button.hover"
                    :while-tap="disabled || isFragmentInserted(note.id) ? undefined : presets.button.tap"
                    :transition="presets.button.transition"
                    @click="emit('insert', note)"
                  >
                    <svg
                      v-if="isFragmentInserted(note.id)"
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
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M19 12H5" />
                      <path d="M12 19l-7-7 7-7" />
                    </svg>
                  </motion.button>

                  <motion.button
                    v-if="isRestorableFragment(note.id)"
                    type="button"
                    class="fragment-item-action-btn fragment-item-action-btn--restore"
                    :disabled="disabled || restoringId === note.id"
                    aria-label="还原至碎片列表"
                    title="还原至碎片列表"
                    :while-hover="disabled || restoringId === note.id ? undefined : presets.button.hover"
                    :while-tap="disabled || restoringId === note.id ? undefined : presets.button.tap"
                    :transition="presets.button.transition"
                    @click="startRestoreConfirm(note)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </motion.button>

                  <motion.button
                    v-if="canRemoveFragment(note.id)"
                    type="button"
                    class="fragment-item-action-btn fragment-item-action-btn--remove"
                    :disabled="disabled"
                    aria-label="移出已选"
                    title="移出已选"
                    :while-hover="disabled ? undefined : presets.button.hover"
                    :while-tap="disabled ? undefined : presets.button.tap"
                    :transition="presets.button.transition"
                    @click="removeFromSelected(note)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </motion.button>

                  <span
                    v-if="isFragmentInserted(note.id)"
                    class="struct-note-fragment-intro-label"
                  >
                    已以「{{ getIntroduceLabel(note.id) }}」引入
                  </span>
                </div>
              </li>
          </ul>
        </div>
      </div>
    </motion.aside>
  </AnimatePresence>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { fetchNotesByIds } from '../../api/note'
import { getIntroduceMethodLabel } from '../../ai/sedimentDraftService'
import {
  getFragmentAttachments,
  getFragmentContent,
  getFragmentFiles,
  getFragmentImages,
  formatFragmentTime,
} from '../../composables/useStructNoteFragments'
import { useMotionPresets } from '../../composables/useMotionPresets'
import StructNoteFragmentAiPicker from './StructNoteFragmentAiPicker.vue'
import GlobalSearchQueryBar from '../search/GlobalSearchQueryBar.vue'
import TiptapPreview from '../common/TiptapPreview.vue'
import NoteImageGallery from '../note/NoteImageGallery.vue'
import NoteFileList from '../note/NoteFileList.vue'
import NoteCard from '../note/NoteCard.vue'

const props = defineProps({
  fragmentNotes: { type: Array, default: () => [] },
  insertedIds: { type: Object, default: () => new Set() },
  insertedIdList: { type: Array, default: () => [] },
  restoredFragmentHint: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  panelTab: {
    type: String,
    default: 'selected',
    validator: (value) => ['selected', 'all'].includes(value),
  },
  mode: {
    type: String,
    default: 'compose',
    validator: (value) => ['compose', 'source'].includes(value),
  },
  restoringId: {
    type: String,
    default: '',
  },
  allFragmentsInserted: {
    type: Boolean,
    default: false,
  },
  enableFragmentPicker: {
    type: Boolean,
    default: false,
  },
  restorableIds: {
    type: Array,
    default: () => [],
  },
  selectedInsertPreset: {
    type: String,
    default: null,
  },
  introducedFragmentMethods: {
    type: Object,
    default: () => ({}),
  },
  aiProcessing: {
    type: Boolean,
    default: false,
  },
  processingFragmentId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'update:open',
  'update:fragmentNotes',
  'update:panelTab',
  'insert',
  'insert-all',
  'stop-ai',
  'restore',
  'update:selectedInsertPreset',
])

const emptyText = computed(() =>
  props.mode === 'source' && !props.enableFragmentPicker
    ? '暂无关联的碎片'
    : '暂无已选，切换到「全部」添加',
)

const showFragmentTabs = computed(
  () => props.mode === 'compose' || props.enableFragmentPicker,
)

const restorableIdSet = computed(
  () => new Set((props.restorableIds || []).map((id) => String(id)).filter(Boolean)),
)

const isRestorableFragment = (id) =>
  props.mode === 'source' && restorableIdSet.value.has(String(id))

const canRemoveFragment = (id) => {
  if (isRestorableFragment(id)) return false
  return props.mode === 'compose' || props.enableFragmentPicker
}

const PANEL_WIDTH_SELECTED = 360
const PANEL_WIDTH_ALL = 436
const fragmentOnlyScopes = ['fragment']

const panelWidthPx = computed(() => {
  if (showFragmentTabs.value && props.panelTab === 'all') return PANEL_WIDTH_ALL
  return PANEL_WIDTH_SELECTED
})

const panelMotionTransition = {
  width: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  opacity: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  x: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
}

const stripSnippetHtml = (html) => String(html || '').replace(/<[^>]+>/g, '')

const mapRestoredToPickerNote = (item) => ({
  id: item.id,
  title: item.title || '',
  markdownContent: item.markdownContent || item.text || '',
  createdAt: item.createdAt || item.createTime,
  tagId: item.tagId ?? null,
  images: item.images || [],
  attachments: item.attachments || item.images || [],
  _searchPreview: false,
})

const refreshAllTabSearch = async () => {
  const runSearch = queryBarRef.value?.query?.runSearch
  if (typeof runSearch === 'function') {
    await runSearch({ reset: true })
  }
}

const mapSearchResultToNote = (item) => {
  const snippetText = (item.snippets || [])
    .map(stripSnippetHtml)
    .filter(Boolean)
    .join('\n\n')
  return {
    id: item.id,
    title: item.tagName || item.title || '',
    markdownContent: snippetText,
    createdAt: item.createTime,
    tagId: item.tagId ?? null,
    images: [],
    _searchPreview: true,
  }
}

const { presets } = useMotionPresets()
const listRef = ref(null)
const allListRef = ref(null)
const queryBarRef = ref(null)
const tabsRef = ref(null)
const allTabRef = ref(null)
const selectedTabRef = ref(null)
const restoringConfirmId = ref('')
const pickerList = ref([])
const tabIndicator = ref({ left: 0, width: 0 })

let syncPickerToken = 0

const query = computed(() => queryBarRef.value?.query ?? null)
const pickerLoading = computed(() => query.value?.loading.value ?? false)
const pickerLoadingMore = computed(() => query.value?.loadingMore.value ?? false)
const searchError = computed(() => query.value?.searchError.value ?? '')
const hasQueried = computed(() => query.value?.hasQueried.value ?? false)
const searchKeywords = computed(() => query.value?.keywords.value ?? [])

const selectedIdSet = computed(
  () => new Set(
    props.fragmentNotes
      .map((note) => String(note?.id ?? ''))
      .filter(Boolean),
  ),
)

const insertedIdSet = computed(() => new Set(
  (props.insertedIdList.length
    ? props.insertedIdList
    : [...(props.insertedIds || [])]
  )
    .map((id) => String(id))
    .filter(Boolean),
))

const isFragmentInserted = (id) => {
  if (id == null || id === '') return false
  return insertedIdSet.value.has(String(id))
}

const visiblePickerList = computed(() =>
  pickerList.value.filter((note) => !isFragmentInserted(note?.id)),
)

const getIntroduceLabel = (id) => {
  const key = String(id)
  return getIntroduceMethodLabel(props.introducedFragmentMethods?.[key])
}

const sortedFragmentNotes = computed(() => {
  const pending = []
  const inserted = []
  for (const note of props.fragmentNotes) {
    if (isFragmentInserted(note?.id)) inserted.push(note)
    else pending.push(note)
  }
  return [...pending, ...inserted]
})

const setPanelTab = (tab) => {
  if (props.panelTab === tab) return
  emit('update:panelTab', tab)
  nextTick(updateTabIndicator)
}

const updateTabIndicator = () => {
  const tabsEl = tabsRef.value
  const activeEl = props.panelTab === 'all' ? allTabRef.value : selectedTabRef.value
  if (!tabsEl || !activeEl) return
  const tabsRect = tabsEl.getBoundingClientRect()
  const activeRect = activeEl.getBoundingClientRect()
  tabIndicator.value = {
    left: activeRect.left - tabsRect.left,
    width: activeRect.width,
  }
}

const onSearchResultsChange = async (records) => {
  const myToken = ++syncPickerToken
  const filtered = (Array.isArray(records) ? records : [])
    .filter((item) => item?.type === 'fragment' && item?.id)
  const previews = filtered.map(mapSearchResultToNote)
  pickerList.value = previews

  if (!filtered.length) return

  const ids = filtered.map((item) => item.id)
  try {
    const notes = await fetchNotesByIds(ids)
    if (myToken !== syncPickerToken) return
    const byId = new Map(notes.map((note) => [String(note.id), note]))
    pickerList.value = ids
      .map((id) => {
        const full = byId.get(String(id))
        if (full) return { ...full, _searchPreview: false }
        return previews.find((item) => String(item.id) === String(id))
      })
      .filter(Boolean)
  } catch {
    if (myToken !== syncPickerToken) return
  }
}

const isNoteSelected = (id) => selectedIdSet.value.has(String(id))

const toggleAllTabSelect = async (note) => {
  if (props.disabled || !note?.id) return
  const ids = selectedIdSet.value
  const noteKey = String(note.id)
  if (ids.has(noteKey)) {
    emit(
      'update:fragmentNotes',
      props.fragmentNotes.filter((item) => String(item.id) !== noteKey),
    )
    return
  }
  let resolved = note
  try {
    const full = await fetchNotesByIds([note.id])
    if (full?.[0]) resolved = full[0]
  } catch {
    /* 保留已有预览数据 */
  }
  emit('update:fragmentNotes', [resolved, ...props.fragmentNotes])
}

const removeFromSelected = (note) => {
  if (props.disabled || !note?.id) return
  emit(
    'update:fragmentNotes',
    props.fragmentNotes.filter((item) => item.id !== note.id),
  )
}

const onAllListScroll = () => {
  query.value?.loadMoreIfNearBottom(allListRef.value)
}

const startRestoreConfirm = (note) => {
  if (props.disabled || !note?.id) return
  restoringConfirmId.value = String(note.id)
}

const cancelRestoreConfirm = () => {
  restoringConfirmId.value = ''
}

const confirmRestore = (note) => {
  if (props.disabled || !note?.id) return
  emit('restore', note)
}

watch(
  () => props.restoredFragmentHint?.at,
  async (at) => {
    if (!at) return
    const restored = props.restoredFragmentHint?.note
    if (!restored?.id) return
    const key = String(restored.id)
    if (!pickerList.value.some((note) => String(note?.id) === key)) {
      pickerList.value = [mapRestoredToPickerNote(restored), ...pickerList.value]
    }
    if (props.open) {
      await refreshAllTabSearch()
    }
  },
)

watch(
  () => props.restoringId,
  (id) => {
    if (!id) restoringConfirmId.value = ''
  },
)

watch(
  () => props.open,
  (open) => {
    if (!open) {
      restoringConfirmId.value = ''
      syncPickerToken += 1
      pickerList.value = []
    } else {
      nextTick(updateTabIndicator)
    }
  },
)

watch(
  () => [props.panelTab, props.open, props.enableFragmentPicker],
  () => {
    if (props.open && showFragmentTabs.value) {
      nextTick(updateTabIndicator)
    }
  },
)

</script>

<style scoped>
.struct-note-fragments {
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid var(--color-border);
}

.struct-note-fragments-inner {
  /* 与 NoteCard 正文一致（全部 tab 实际渲染字号） */
  --fragments-list-font-size: 14px;
  --fragments-list-line-height: 1.6;
  --fragments-list-tag-font: 11px;
  --fragments-list-time-font: 10px;
  --fragments-list-tile-size: 67px;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 0 0 20px;
  box-sizing: border-box;
}

.struct-note-fragments-all-pane,
.struct-note-fragments-selected-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.struct-note-fragments-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  padding-right: 4px;
}

.struct-note-fragments-tabs {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 9px;
  background: rgba(24, 24, 27, 0.06);
}

.struct-note-fragments-tab-indicator {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 0;
  border-radius: 7px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.1);
  pointer-events: none;
  z-index: 0;
}

.struct-note-fragments-tab {
  position: relative;
  z-index: 1;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.14s ease;
}

.struct-note-fragments-tab:hover {
  color: var(--color-primary);
}

.struct-note-fragments-tab[aria-selected='true'] {
  color: var(--color-primary);
}

.struct-note-fragments-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.struct-note-fragments-insert-all {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.struct-note-fragments-insert-all:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.28);
  background: #fff;
}

.struct-note-fragments-insert-all:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.struct-note-fragments-insert-all.is-stop {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
}

.struct-note-fragments-insert-all.is-stop:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.4);
  background: rgba(37, 99, 235, 0.12);
}

.struct-note-fragments-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-secondary-text);
}

.struct-note-fragments-search {
  flex: 0 0 auto;
  margin: 0 12px 0 8px;
}

.struct-note-fragments-all-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 12px 12px 12px 8px;
}

.struct-note-fragments-empty--error {
  color: #dc2626;
}

.struct-note-fragments-summary {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--color-secondary-text);
}

.struct-note-fragments-summary-icon {
  flex-shrink: 0;
  margin-top: 1px;
  opacity: 0.72;
}

.struct-note-fragments-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
  cursor: pointer;
}

.struct-note-fragments-empty {
  margin: 0;
  padding: 8px 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
}

.struct-note-fragments-empty--more {
  padding-top: 4px;
  text-align: center;
}

.struct-note-fragments-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0 4px 12px 0;
  list-style: none;
}

.struct-note-fragments-list,
.struct-note-fragments-all-list {
  scrollbar-gutter: stable;
}

.struct-note-fragment-item {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
}

.struct-note-fragment-item.is-restoring {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(37, 99, 235, 0.04);
}

.struct-note-fragments-all-item {
  flex: 0 0 auto;
}

.struct-note-fragment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-bottom: 6px;
}

.struct-note-fragment-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font-size: var(--fragments-list-tag-font);
  line-height: 1.45;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.struct-note-fragment-time {
  color: #a1a1aa;
  font-size: var(--fragments-list-time-font);
  font-weight: 400;
  letter-spacing: 0.2px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.struct-note-fragment-intro-label {
  margin-left: auto;
  font-size: 10px;
  line-height: 1.4;
  color: #a1a1aa;
  white-space: nowrap;
}

.struct-note-fragment-main {
  flex: 1;
  min-width: 0;
}

.struct-note-fragment-content {
  font-size: var(--fragments-list-font-size);
  line-height: var(--fragments-list-line-height);
  color: var(--color-text);
  word-break: break-word;
}

.struct-note-fragment-content :deep(.tiptap-content .ProseMirror) {
  font-size: var(--fragments-list-font-size);
  line-height: var(--fragments-list-line-height);
}

.struct-note-fragment-content :deep(.tiptap-content .ProseMirror > :last-child) {
  margin-bottom: 0;
}

.struct-note-fragment-content :deep(.gallery) {
  margin-top: 6px;
}

.struct-note-fragment-content :deep(.tile) {
  width: var(--fragments-list-tile-size);
  height: var(--fragments-list-tile-size);
}

.struct-note-fragment-content :deep(.tile-overlay) {
  width: 20px;
  height: 20px;
}

.struct-note-fragment-empty {
  margin: 0;
  font-size: var(--fragments-list-font-size);
  color: var(--color-secondary-text);
}

.struct-note-fragment-footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(24, 24, 27, 0.06);
}

.fragment-item-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-secondary-text);
  cursor: pointer;
}

.fragment-item-action-btn:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.28);
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.06);
}

.fragment-item-action-btn:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.fragment-item-action-btn.is-added {
  border-color: rgba(24, 24, 27, 0.08);
  background: rgba(24, 24, 27, 0.04);
  color: var(--color-success);
}

.fragment-item-action-btn--restore:hover:not(:disabled),
.fragment-item-action-btn--remove:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.28);
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.06);
}

.fragment-restore-confirm {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(37, 99, 235, 0.12);
}

.fragment-restore-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-primary);
  white-space: nowrap;
}

.fragment-restore-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.fragment-restore-btn {
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.fragment-restore-btn--yes {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  box-shadow: var(--btn-primary-shadow);
}

.fragment-restore-btn--yes:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
  box-shadow: var(--btn-primary-shadow-hover);
}

.fragment-restore-btn--no {
  background: #fff;
  color: var(--color-secondary-text);
  border: 1px solid var(--color-border);
}

.fragment-restore-btn--no:hover:not(:disabled) {
  color: var(--color-primary);
}

.fragment-restore-btn:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .struct-note-fragments-inner {
    width: 100%;
    max-height: 220px;
    padding-top: 16px;
  }

  .struct-note-fragments {
    border-left: 0;
    border-top: 1px solid var(--color-border);
  }
}
</style>
