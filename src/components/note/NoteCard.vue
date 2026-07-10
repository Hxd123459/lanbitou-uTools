<template>
  <article
    class="note-card"
    :class="{
      'is-editing': isEditing,
      'is-pinned-top': isPinnedTop,
      'is-pinned-bottom': isPinnedBottom,
      'is-selectable': selectable,
      'is-selected': selectable && selected && !selectionRemovable,
      'is-selection-removable': selectable && selectionRemovable,
      'is-compact': compact,
    }"
    @click="onSelectableCardClick"
    @dblclick="onCardDblClick"
  >
    <button
      v-if="selectable && !note?.isPending"
      type="button"
      class="note-select-control"
      :aria-pressed="selectionRemovable ? true : selected"
      :aria-label="selectionRemovable ? '移出已选' : selected ? '取消选中' : '选中笔记'"
      @click.stop="emit('toggle-select')"
    >
      <motion.span
        class="note-select-box"
        :class="{
          'note-select-box--remove': selectionRemovable,
          'is-checked': selected && !selectionRemovable,
        }"
        aria-hidden="true"
        :animate="selectBoxMotion"
        :transition="presets.fast"
      >
        <AnimatePresence mode="wait" :initial="false">
          <motion.svg
            v-if="selectionRemovable"
            key="remove"
            viewBox="0 0 24 24"
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            :initial="selectIconMotion.initial"
            :animate="selectIconMotion.animate"
            :exit="selectIconMotion.exit"
            :transition="selectIconMotion.transition"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </motion.svg>
          <motion.svg
            v-else-if="selected"
            key="check"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            :initial="selectIconMotion.initial"
            :animate="selectIconMotion.animate"
            :exit="selectIconMotion.exit"
            :transition="selectIconMotion.transition"
          >
            <path d="m5 12 4 4L19 6" />
          </motion.svg>
        </AnimatePresence>
      </motion.span>
    </button>

    <div class="note-card-main">
    <div class="note-meta">
      <div class="meta-left">
        <span v-if="tagAiLoading && !isEditing" class="note-tag note-tag-ai-loading">
          <svg
            class="note-tag-ai-spinner"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            aria-hidden="true"
          >
            <path d="M12 2v4" />
            <path d="M12 18v4" opacity="0.3" />
            <path d="m4.93 4.93 2.83 2.83" opacity="0.5" />
            <path d="m16.24 16.24 2.83 2.83" opacity="0.15" />
            <path d="M2 12h4" opacity="0.7" />
            <path d="M18 12h4" opacity="0.2" />
            <path d="m4.93 19.07 2.83-2.83" opacity="0.85" />
            <path d="m16.24 7.76 2.83-2.83" opacity="0.4" />
          </svg>
          <span class="note-tag-ai-loading-text">打标中</span>
        </span>
        <button
          v-else-if="titleText && !isEditing"
          type="button"
          class="note-tag"
          :title="`查看标签「${titleText}」下的笔记`"
          @click.stop="onTagClick"
        >
          {{ titleText }}
        </button>
        <span v-if="isPinnedTop" class="pin-badge pin-badge-top">置顶</span>
        <span v-else-if="isPinnedBottom" class="pin-badge pin-badge-bottom"
          >置底</span
        >
        <span class="note-time">{{ metaTimeText }}</span>
      </div>
      <div v-if="!selectable && !note?.isPending" class="meta-right">
      <div class="meta-actions">
        <motion.button
          v-if="!isEditing"
          class="icon-btn"
          :class="{ 'is-active': isPinnedTop }"
          type="button"
          :title="isPinnedTop ? '取消置顶' : '置顶'"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="onTogglePin('TOP')"
        >
          <svg
            class="pin-icon pin-icon-top"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m8 11 4 4 4-4" />
            <path d="M4 21h16" />
          </svg>
        </motion.button>
        <motion.button
          v-if="!isEditing"
          class="icon-btn"
          :class="{ 'is-active': isPinnedBottom }"
          type="button"
          :title="isPinnedBottom ? '取消置底' : '置底'"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="onTogglePin('BOTTOM')"
        >
          <svg
            class="pin-icon"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m8 11 4 4 4-4" />
            <path d="M4 21h16" />
          </svg>
        </motion.button>
        <motion.button
          v-if="!isEditing"
          ref="copyBtnRef"
          class="icon-btn"
          :class="{ 'is-active': copyMenuOpen }"
          type="button"
          title="复制"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click.stop="toggleCopyMenu"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </motion.button>
        <motion.button
          v-if="!isEditing"
          class="icon-btn"
          type="button"
          title="编辑"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="enterEdit"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </motion.button>
        <motion.button
          v-if="!isEditing"
          class="icon-btn icon-btn-danger"
          type="button"
          title="删除"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="onDelete"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </motion.button>
      </div>
      <motion.button
        v-if="hasRecallId && !isEditing"
        type="button"
        class="recall-indicator"
        aria-label="回响"
        title="回响"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click.stop="openRecallModal"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"
        >
          <motion.circle
            cx="12"
            cy="12"
            r="8"
            :animate="recallMotion.outer"
            :transition="recallTransition(0)"
          />
          <motion.circle
            cx="12"
            cy="12"
            r="5"
            :animate="recallMotion.inner"
            :transition="recallTransition(0.4)"
          />
          <motion.circle
            cx="12"
            cy="12"
            r="1.75"
            fill="currentColor"
            stroke="none"
            :animate="recallMotion.dot"
            :transition="recallTransition(0.2)"
          />
        </svg>
      </motion.button>
      </div>
    </div>

    <NoteRecallModal
      :visible="recallModalOpen"
      :ai-note-recall-id="note.aiNoteRecallId"
      @close="recallModalOpen = false"
      @recall-clicked="onRecallClicked"
    />

    <template v-if="note?.isPending">
      <div class="skeleton-line w-70" />
      <div class="skeleton-line w-100" />
      <div class="skeleton-line w-85" />
    </template>

    <template v-else-if="isEditing">
      <textarea
        ref="editorRef"
        v-model="draftContent"
        class="note-editor"
        spellcheck="false"
        :disabled="saving"
        :style="{ height: editorHeight + 'px' }"
        @input="onEditorInput"
        @focus="onEditorFocus"
        @blur="onEditorBlur"
        @keydown="onEditorKeydown"
        @paste="onEditorPaste"
        @click="onEditorCaretChange"
        @keyup="onEditorCaretChange"
      />

      <AttachmentStrip
        v-if="editStripItems.length"
        :items="editStripItems"
        :disabled="saving"
        class="editor-attachment-strip"
        @remove="removeDraftAttachment"
      />

      <input
        ref="editImageInputRef"
        type="file"
        accept="image/*"
        multiple
        class="hidden-file-input"
        @change="onPickEditImages"
      />
      <input
        ref="editFileInputRef"
        type="file"
        multiple
        class="hidden-file-input"
        @change="onPickEditFiles"
      />

      <div class="editor-bar">
        <div class="editor-bar-left">
          <AnimatePresence mode="wait">
            <motion.span
              v-if="selectedTag"
              :key="selectedTag.tagId || selectedTag.tagName"
              class="tag-chip"
              :initial="presets.swapLabel.initial"
              :animate="presets.swapLabel.animate"
              :exit="presets.swapLabel.exit"
              :transition="presets.swapLabel.transition"
            >
              <span class="tag-chip-label">#{{ selectedTag.tagName }}</span>
              <motion.button
                type="button"
                class="tag-chip-remove"
                :disabled="saving"
                aria-label="移除标签"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="clearSelectedTag"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    fill="none"
                  />
                </svg>
              </motion.button>
            </motion.span>
          </AnimatePresence>

          <AppButton
            class="btn btn-icon"
            :disabled="saving || !canAddEditImage"
            :title="canAddEditImage ? '从本地选择图片' : `最多 ${MAX_ATTACHMENTS} 个附件`"
            aria-label="选择本地图片"
            @click="openEditImagePicker"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="2.5"
                stroke="currentColor"
                stroke-width="1.6"
                fill="none"
              />
              <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
              <path
                d="M4.5 17.5l4.5-5 4 4 2.5-3 4 5"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
          </AppButton>
          <AppButton
            class="btn btn-icon"
            :disabled="saving || !canAddEditFile"
            :title="canAddEditFile ? '从本地选择附件' : `最多 ${MAX_ATTACHMENTS} 个附件`"
            aria-label="选择本地附件"
            @click="openEditFilePicker"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
          </AppButton>
          <span
            v-if="draftAttachmentCount"
            class="counter"
            :class="{ 'counter-full': draftAttachmentCount >= MAX_ATTACHMENTS }"
          >
            {{ draftAttachmentCount }}<span class="counter-divider">/</span
            >{{ MAX_ATTACHMENTS }}
          </span>
        </div>
        <div class="editor-bar-right">
          <span class="editor-hint">
            <kbd>{{ shortcutLabel }}</kbd>
            <span class="hint-plus">+</span>
            <kbd>Enter</kbd>
            <span class="hint-text">保存</span>
          </span>
          <button
            type="button"
            class="link-btn"
            :disabled="saving"
            @click="cancelEdit"
          >
            取消
          </button>
          <AppButton
            class="btn btn-primary"
            :disabled="saving || !canSave"
            @click="saveEdit"
          >
            {{ saving ? '保存中…' : '保存' }}
          </AppButton>
        </div>
      </div>
    </template>

    <template v-else>
      <div ref="contentRootRef" class="note-content-root">
        <TiptapPreview
          v-if="contentText"
          :content="contentText"
          :show-fallback="false"
          @updated="scheduleHighlight"
        />
        <p
          v-else-if="!hasVisibleContent"
          class="note-text-fallback"
        >
          {{ '（暂无内容）' }}
        </p>
      </div>

      <NoteImageGallery v-if="images.length" :images="images" />
      <NoteFileList
        v-if="fileAttachments.length"
        :attachments="fileAttachments"
        :compact="compact"
      />
    </template>
    </div>

    <Teleport to="body">
      <div
        v-if="tagMenuOpen"
        class="struct-note-slash-menu"
        data-tag-hash-menu
        role="listbox"
        aria-label="选择标签"
        :style="tagMenuStyle"
        @mousedown="onTagMenuMouseDown"
      >
        <p v-if="tagMenuLoading" class="tag-hash-menu-state">加载标签中…</p>
        <p v-else-if="!tagMenuItems.length" class="tag-hash-menu-state">
          输入标签名，最多 5 个字
        </p>
        <button
          v-for="(item, index) in tagMenuItems"
          :key="`${item.type}-${item.tagName}`"
          type="button"
          class="struct-note-slash-menu__item"
          :class="{ 'struct-note-slash-menu__item--active': index === tagMenuIndex }"
          role="option"
          :aria-selected="index === tagMenuIndex"
          @click="applyTagMenuItem(item)"
        >
          <span class="struct-note-slash-menu__icon" aria-hidden="true">
            <svg
              v-if="item.type === 'create'"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span v-else class="tag-hash-menu-hash">#</span>
          </span>
          <span class="struct-note-slash-menu__label">{{ item.label }}</span>
        </button>
      </div>

      <div
        v-if="copyMenuOpen"
        ref="copyMenuRef"
        class="struct-note-slash-menu struct-note-slash-menu--compact"
        data-note-copy-menu
        role="listbox"
        aria-label="复制选项"
        :style="copyMenuStyle"
        @mousedown.prevent
      >
        <button
          v-for="(item, index) in copyMenuItems"
          :key="item.mode"
          type="button"
          class="struct-note-slash-menu__item"
          :class="{ 'struct-note-slash-menu__item--active': index === copyMenuIndex }"
          role="option"
          :aria-selected="index === copyMenuIndex"
          :disabled="item.disabled || copyBusy"
          @click="applyCopyMenuItem(item)"
        >
          <span class="struct-note-slash-menu__icon" aria-hidden="true">
            <svg
              v-if="item.mode === 'plain'"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 4v16" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </span>
          <span class="struct-note-slash-menu__label">{{ item.label }}</span>
        </button>
      </div>
    </Teleport>
  </article>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { MAX_ATTACHMENTS } from '../../constants/uploadLimits'
import { useAttachmentDraft } from '../../composables/useAttachmentDraft'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useTagHashPicker } from '../../composables/useTagHashPicker'
import { markClipboardImageHandledByPaste } from '../../composables/useUtoolsClipboardEnter'
import {
  extractClipboardImageFiles,
  insertTextAtTextareaCursor,
} from '../../utils/tiptapImageInsert'
import { extractClipboardAttachmentFiles } from '../../utils/tiptapAttachmentInsert'
import { getAttachmentKind } from '../../utils/attachmentDisplay'
import { useAssistantStore } from '../../stores/assistantStore'
import AppButton from '../motion/AppButton.vue'
import AttachmentStrip from './AttachmentStrip.vue'
import NoteFileList from './NoteFileList.vue'
import '../../assets/styles/tiptap-slash-menu.css'
import TiptapPreview from '../common/TiptapPreview.vue'
import NoteImageGallery from './NoteImageGallery.vue'
import NoteRecallModal from './NoteRecallModal.vue'
import {
  findMergedHighlightRanges,
  normalizeHighlightKeywords,
} from '../../utils/searchHighlight'
import {
  copyNoteByMode,
  getNoteImages,
  getNotePlainText,
} from '../../utils/copyNoteContent'

const { presets, reduced } = useMotionPresets()

const selectBoxMotion = computed(() => {
  if (props.selectionRemovable) {
    return { scale: 1 }
  }
  return {
    scale: props.selected ? 1 : 0.92,
  }
})

const selectIconMotion = computed(() => ({
  initial: { opacity: 0, scale: 0.45 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.45 },
  transition: presets.value.fast,
}))

const props = defineProps({
  note: {
    type: Object,
    required: true,
  },
  highlight: {
    type: [String, Array],
    default: '',
  },
  selectable: {
    type: Boolean,
    default: false,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  selectionRemovable: {
    type: Boolean,
    default: false,
  },
  disableEdit: {
    type: Boolean,
    default: false,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  tagAiLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'edit-save',
  'delete',
  'copied',
  'copy-failed',
  'pin',
  'image-too-large',
  'file-too-large',
  'toggle-select',
  'tag-select',
])

const assistantStore = useAssistantStore()

const EDITOR_MIN_HEIGHT = 60
const EDITOR_MAX_HEIGHT = 480

const draftContent = ref('')
const selectedTag = ref(null)
const {
  items: draftAttachmentItems,
  stripItems: buildEditStripItems,
  remaining: remainingDraftAttachmentSlots,
  appendFiles: appendDraftAttachmentFiles,
  removeItem: removeDraftAttachmentItem,
  resetItems: resetDraftAttachments,
  cloneFromNoteAttachments,
  getNewFiles: getDraftNewFiles,
  getRetainedIds: getDraftRetainedIds,
  payloadChanged: draftAttachmentsChanged,
} = useAttachmentDraft({ maxCount: MAX_ATTACHMENTS })
const saving = ref(false)
const editorRef = ref(null)
const editImageInputRef = ref(null)
const editFileInputRef = ref(null)
const contentRootRef = ref(null)
const isMac = ref(false)
const editorHeight = ref(EDITOR_MIN_HEIGHT)
const isEditorFocused = ref(false)

let listScrollEl = null
let lastListScrollTop = 0
let selectClickTimer = null

const CARD_INTERACTIVE_SELECTOR =
  'a, button, input, textarea, label, .attachment-strip, .editor-attachment-strip, .gallery, .file-list, .tile, .note-select-control, .note-tag, .lightbox, [data-note-copy-menu]'

const HIGHLIGHT_CLASS = 'note-highlight'
const HIGHLIGHT_SKIP_SELECTOR = 'pre, code, .hljs'

const isEditing = computed(
  () => assistantStore.editingNoteId === props.note?.id,
)

const shortcutLabel = computed(() => (isMac.value ? '⌘' : 'Ctrl'))

const contentText = computed(
  () => props.note?.markdownContent || props.note?.text || '',
)
const attachments = computed(() => {
  if (Array.isArray(props.note?.attachments) && props.note.attachments.length) {
    return props.note.attachments
  }
  return Array.isArray(props.note?.images) ? props.note.images : []
})
const images = computed(() =>
  attachments.value.filter((item) => getAttachmentKind(item) === 'image'),
)
const fileAttachments = computed(() =>
  attachments.value.filter((item) => getAttachmentKind(item) === 'file'),
)
const hasVisibleContent = computed(
  () => !!contentText.value || images.value.length > 0 || fileAttachments.value.length > 0,
)
const titleText = computed(() => props.note?.title || '')
const originalTagId = computed(() => {
  const id = props.note?.tagId
  return id != null && id !== '' ? String(id) : null
})
const timeText = computed(() => formatTime(props.note?.createdAt))
const noteCharCount = computed(() => {
  const text = contentText.value.replace(/\s/g, '')
  return text.length
})
const metaTimeText = computed(() => {
  const time = timeText.value
  const count = noteCharCount.value
  if (!count) return time
  return `${time} · ${count}字`
})

const {
  menuOpen: tagMenuOpen,
  menuStyle: tagMenuStyle,
  selectedIndex: tagMenuIndex,
  filteredItems: tagMenuItems,
  tagsLoading: tagMenuLoading,
  loadTags,
  syncMenu: syncTagMenu,
  closeMenu: closeTagMenu,
  applyItem: applyTagMenuItem,
  handleKeyDown: handleTagMenuKeyDown,
  onMenuMouseDown: onTagMenuMouseDown,
  onTextareaBlur: onTagTextareaBlur,
} = useTagHashPicker({
  getText: () => draftContent.value,
  setText: (value) => {
    draftContent.value = value
  },
  getTextarea: () => editorRef.value,
  onTagSelected: (tag) => {
    selectedTag.value = tag
  },
})
const pinType = computed(() => props.note?.pinWeightType || 'DEFAULT')
const isPinnedTop = computed(() => pinType.value === 'TOP')
const isPinnedBottom = computed(() => pinType.value === 'BOTTOM')
const recallClicked = ref(false)
const hasRecallId = computed(
  () =>
    !recallClicked.value &&
    props.note?.aiNoteRecallId != null &&
    props.note?.aiNoteRecallId !== '',
)
const recallModalOpen = ref(false)

const copyBtnRef = ref(null)
const copyMenuRef = ref(null)
const copyMenuOpen = ref(false)
const copyMenuIndex = ref(0)
const copyBusy = ref(false)
const copyMenuStyle = ref({ left: '0px', top: '0px', visibility: 'hidden' })

const copyMenuItems = computed(() => {
  const plain = getNotePlainText(props.note)
  const images = getNoteImages(props.note)
  return [
    {
      mode: 'plain',
      label: '复制纯文本',
      disabled: !plain,
    },
    {
      mode: 'rich',
      label: '复制（含图片）',
      disabled: !plain && !images.length,
    },
  ]
})

const openRecallModal = () => {
  if (!hasRecallId.value) return
  recallModalOpen.value = true
}

const onRecallClicked = () => {
  recallClicked.value = true
}

watch(
  () => props.note?.id,
  () => {
    recallClicked.value = false
  },
)

const recallMotion = computed(() => {
  if (reduced.value) {
    return { outer: {}, inner: {}, dot: {} }
  }
  return {
    outer: { opacity: [0.3, 1, 0.3] },
    inner: { opacity: [0.45, 1, 0.45] },
    dot: { scale: [1, 1.4, 1], opacity: [0.65, 1, 0.65] },
  }
})

const recallTransition = (delay = 0) => ({
  duration: reduced.value ? 0 : 1.6,
  repeat: reduced.value ? 0 : Infinity,
  ease: 'easeInOut',
  delay,
})
const originalOrderedAttachmentIds = computed(() =>
  attachments.value.map((item) => item.id).filter((id) => id != null),
)

const imagesPayloadChanged = computed(() =>
  draftAttachmentsChanged(originalOrderedAttachmentIds.value),
)

const editStripItems = computed(() => buildEditStripItems())
const draftAttachmentCount = computed(() => draftAttachmentItems.value.length)
const canAddEditImage = computed(
  () => !saving.value && remainingDraftAttachmentSlots() > 0,
)
const canAddEditFile = computed(
  () => !saving.value && remainingDraftAttachmentSlots() > 0,
)

const handleDraftAppendResult = (result) => {
  if (result.imageTooLarge) emit('image-too-large')
  if (result.fileTooLarge) emit('file-too-large')
}

const tagChanged = computed(() => {
  const draftId = selectedTag.value?.tagId ?? null
  const draftName = selectedTag.value?.tagName ?? ''
  if (draftId !== originalTagId.value) return true
  return draftName !== titleText.value
})

const hasChanges = computed(
  () =>
    draftContent.value !== contentText.value ||
    tagChanged.value ||
    imagesPayloadChanged.value,
)

const hasSavableContent = computed(
  () =>
    draftContent.value.trim().length > 0 || draftAttachmentCount.value > 0,
)

const canSave = computed(() => hasChanges.value && hasSavableContent.value)

const measureEditorHeight = (el) => {
  editorHeight.value = EDITOR_MIN_HEIGHT
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const next = Math.min(
        Math.max(el.scrollHeight, EDITOR_MIN_HEIGHT),
        EDITOR_MAX_HEIGHT,
      )
      editorHeight.value = next
      resolve(next)
    })
  })
}

const adjustEditorHeight = async () => {
  const el = editorRef.value
  if (!el) return
  await measureEditorHeight(el)
}

const shrinkEditorHeight = async () => {
  const el = editorRef.value
  if (!el) return
  if (!draftContent.value.trim()) {
    editorHeight.value = EDITOR_MIN_HEIGHT
    return
  }
  await adjustEditorHeight()
}

const bindListScroll = () => {
  unbindListScroll()
  listScrollEl = editorRef.value?.closest('.note-list') ?? null
  lastListScrollTop = listScrollEl?.scrollTop ?? 0
  listScrollEl?.addEventListener('scroll', onListScroll, { passive: true })
}

const unbindListScroll = () => {
  listScrollEl?.removeEventListener('scroll', onListScroll)
  listScrollEl = null
}

const onListScroll = () => {
  if (!isEditing.value || !listScrollEl) return
  const top = listScrollEl.scrollTop
  if (top < lastListScrollTop) {
    isEditorFocused.value = false
    shrinkEditorHeight()
  }
  lastListScrollTop = top
}

const onEditorFocus = () => {
  isEditorFocused.value = true
  nextTick(adjustEditorHeight)
}

const onEditorBlur = () => {
  isEditorFocused.value = false
  onTagTextareaBlur()
  nextTick(shrinkEditorHeight)
}

const onEditorInput = () => {
  nextTick(async () => {
    await adjustEditorHeight()
    await syncTagMenu()
  })
}

const onEditorCaretChange = () => {
  nextTick(() => syncTagMenu())
}

const clearSelectedTag = () => {
  selectedTag.value = null
}

const enterEdit = async () => {
  if (props.note?.isPending || saving.value || isEditing.value) return
  resetDraftAttachments()
  draftContent.value = contentText.value
  const tagId = originalTagId.value
  const tagName = titleText.value
  selectedTag.value =
    tagId || tagName ? { tagId, tagName: tagName || '' } : null
  draftAttachmentItems.value = cloneFromNoteAttachments(attachments.value)
  loadTags()
  editorHeight.value = EDITOR_MIN_HEIGHT
  assistantStore.setEditingNoteId(props.note.id)
  await nextTick()
  await adjustEditorHeight()
  bindListScroll()
  editorRef.value?.focus()
}

const cancelEdit = () => {
  if (saving.value) return
  unbindListScroll()
  editorHeight.value = EDITOR_MIN_HEIGHT
  resetDraftAttachments()
  draftContent.value = ''
  selectedTag.value = null
  closeTagMenu()
  if (assistantStore.editingNoteId === props.note.id) {
    assistantStore.setEditingNoteId(null)
  }
}

const removeDraftAttachment = (key) => {
  if (saving.value) return
  removeDraftAttachmentItem(key)
}

const openEditImagePicker = () => {
  if (saving.value || !canAddEditImage.value) return
  editImageInputRef.value?.click()
}

const openEditFilePicker = () => {
  if (saving.value || !canAddEditFile.value) return
  editFileInputRef.value?.click()
}

const onPickEditImages = (event) => {
  const picked = Array.from(event.target.files || [])
  if (picked.length) handleDraftAppendResult(appendDraftAttachmentFiles(picked))
  event.target.value = ''
}

const onPickEditFiles = (event) => {
  const picked = Array.from(event.target.files || [])
  if (picked.length) handleDraftAppendResult(appendDraftAttachmentFiles(picked))
  event.target.value = ''
}

const onEditorPaste = (event) => {
  if (saving.value) return
  const clipboardData = event.clipboardData
  if (!clipboardData) return

  const imageFiles = extractClipboardImageFiles(clipboardData)
  const otherFiles = extractClipboardAttachmentFiles(clipboardData).filter(
    (file) => !imageFiles.includes(file),
  )
  const files = [...imageFiles, ...otherFiles]
  if (!files.length) return

  event.preventDefault()
  markClipboardImageHandledByPaste()

  const plain = clipboardData.getData('text/plain')
  if (plain) {
    insertTextAtTextareaCursor(
      editorRef.value,
      draftContent.value,
      plain,
      (value) => {
        draftContent.value = value
      },
    )
  }

  handleDraftAppendResult(appendDraftAttachmentFiles(files))
}

const onEditorKeydown = (event) => {
  if (event.isComposing) return
  if (handleTagMenuKeyDown(event)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
    return
  }
  if (event.key === 'Enter') {
    const modifierPressed = isMac.value ? event.metaKey : event.ctrlKey
    if (modifierPressed) {
      event.preventDefault()
      saveEdit()
    }
  }
}

const saveEdit = async () => {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    const payload = {
      id: props.note.id,
      title: selectedTag.value?.tagName ?? '',
      tagId: selectedTag.value?.tagId ?? null,
      tagName: selectedTag.value?.tagName ?? '',
      content: draftContent.value,
    }
    if (imagesPayloadChanged.value) {
      payload.retainedImageIds = getDraftRetainedIds()
      payload.newImages = getDraftNewFiles()
    }
    await Promise.resolve(emit('edit-save', payload))
    unbindListScroll()
    editorHeight.value = EDITOR_MIN_HEIGHT
    resetDraftAttachments()
    draftContent.value = ''
    selectedTag.value = null
    closeTagMenu()
    if (assistantStore.editingNoteId === props.note.id) {
      assistantStore.setEditingNoteId(null)
    }
  } finally {
    saving.value = false
  }
}

const onDelete = () => {
  emit('delete', { id: props.note.id })
}

const onTogglePin = (target) => {
  const next = pinType.value === target ? 'DEFAULT' : target
  emit('pin', { id: props.note.id, pinWeightValue: next })
}

const closeCopyMenu = () => {
  copyMenuOpen.value = false
  copyMenuIndex.value = 0
  copyMenuStyle.value = { left: '0px', top: '0px', visibility: 'hidden' }
}

const positionCopyMenu = async () => {
  const anchor = copyBtnRef.value?.$el ?? copyBtnRef.value
  if (!(anchor instanceof HTMLElement)) return

  await nextTick()
  const viewportPadding = 8
  const menuGap = 6
  const rect = anchor.getBoundingClientRect()
  let left = rect.left
  let top = rect.bottom + menuGap

  copyMenuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    visibility: 'hidden',
  }

  requestAnimationFrame(() => {
    const menuEl = copyMenuRef.value
    if (!menuEl) return

    const menuRect = menuEl.getBoundingClientRect()
    if (menuRect.bottom > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - menuRect.height - menuGap)
    }
    if (left + menuRect.width > window.innerWidth - viewportPadding) {
      left = Math.max(
        viewportPadding,
        window.innerWidth - menuRect.width - viewportPadding,
      )
    }

    copyMenuStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
      visibility: 'visible',
    }
  })
}

const toggleCopyMenu = async () => {
  if (copyMenuOpen.value) {
    closeCopyMenu()
    return
  }
  copyMenuOpen.value = true
  copyMenuIndex.value = copyMenuItems.value.findIndex((item) => !item.disabled)
  if (copyMenuIndex.value < 0) copyMenuIndex.value = 0
  await positionCopyMenu()
}

const applyCopyMenuItem = async (item) => {
  if (!item || item.disabled || copyBusy.value) return
  copyBusy.value = true
  try {
    const result = await copyNoteByMode(props.note, item.mode)
    closeCopyMenu()
    emit('copied', result)
  } catch (error) {
    console.error('[NoteCard] copy failed:', error)
    closeCopyMenu()
    emit('copy-failed', { mode: item.mode })
  } finally {
    copyBusy.value = false
  }
}

const onCopyMenuDocumentClick = (event) => {
  if (!copyMenuOpen.value) return
  const anchor = copyBtnRef.value?.$el ?? copyBtnRef.value
  const menuEl = copyMenuRef.value
  const target = event.target
  if (anchor?.contains?.(target) || menuEl?.contains?.(target)) return
  closeCopyMenu()
}

const onCopyMenuKeydown = (event) => {
  if (!copyMenuOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeCopyMenu()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    let next = copyMenuIndex.value
    do {
      next = (next + 1) % copyMenuItems.value.length
    } while (
      copyMenuItems.value[next]?.disabled &&
      next !== copyMenuIndex.value
    )
    copyMenuIndex.value = next
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    let next = copyMenuIndex.value
    do {
      next =
        (next - 1 + copyMenuItems.value.length) % copyMenuItems.value.length
    } while (
      copyMenuItems.value[next]?.disabled &&
      next !== copyMenuIndex.value
    )
    copyMenuIndex.value = next
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const item = copyMenuItems.value[copyMenuIndex.value]
    if (item && !item.disabled) applyCopyMenuItem(item)
  }
}

watch(
  () => assistantStore.editingNoteId,
  (newId) => {
    if (newId !== props.note.id) {
      unbindListScroll()
      editorHeight.value = EDITOR_MIN_HEIGHT
      if (draftContent.value) draftContent.value = ''
      selectedTag.value = null
      closeTagMenu()
      closeCopyMenu()
      resetDraftAttachments()
    }
  },
)

onBeforeUnmount(() => {
  clearSelectClickTimer()
  unbindListScroll()
  resetDraftAttachments()
  document.removeEventListener('click', onCopyMenuDocumentClick, true)
  document.removeEventListener('keydown', onCopyMenuKeydown, true)
})

onMounted(() => {
  document.addEventListener('click', onCopyMenuDocumentClick, true)
  document.addEventListener('keydown', onCopyMenuKeydown, true)
  const platform =
    (typeof navigator !== 'undefined' &&
      (navigator.userAgentData?.platform || navigator.platform || '')) ||
    ''
  isMac.value = /Mac|iPhone|iPad|iPod/i.test(platform)
  scheduleHighlight()
})

function clearHighlight(root) {
  if (!root) return
  const marks = root.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`)
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
  })
  root.normalize()
}

function applyHighlight() {
  const root = contentRootRef.value
  if (!root) return
  clearHighlight(root)
  const keywords = normalizeHighlightKeywords(props.highlight)
  if (!keywords.length) return

  const targets = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT
      const parent = node.parentNode
      if (!parent || parent.nodeType !== 1) return NodeFilter.FILTER_REJECT
      const tag = parent.nodeName.toLowerCase()
      if (tag === 'mark' || tag === 'script' || tag === 'style') {
        return NodeFilter.FILTER_REJECT
      }
      if (parent.closest && parent.closest(HIGHLIGHT_SKIP_SELECTOR)) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let current = walker.nextNode()
  while (current) {
    targets.push(current)
    current = walker.nextNode()
  }

  targets.forEach((textNode) => {
    const text = textNode.nodeValue || ''
    const ranges = findMergedHighlightRanges(text, keywords)
    if (!ranges.length) return

    const frag = document.createDocumentFragment()
    let cursor = 0
    ranges.forEach(({ start, end }) => {
      if (start > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, start)))
      }
      const mark = document.createElement('mark')
      mark.className = HIGHLIGHT_CLASS
      mark.textContent = text.slice(start, end)
      frag.appendChild(mark)
      cursor = end
    })
    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)))
    }
    textNode.parentNode?.replaceChild(frag, textNode)
  })
}

const scheduleHighlight = () => {
  nextTick(applyHighlight)
}

watch(
  () => [props.highlight, contentText.value, isEditing.value],
  () => {
    scheduleHighlight()
  },
  { flush: 'post' },
)

const onTagClick = () => {
  const tagId = originalTagId.value
  const tagName = titleText.value
  if (!tagId || !tagName) return
  emit('tag-select', { tagId, tagName })
}

const clearSelectClickTimer = () => {
  if (selectClickTimer) {
    clearTimeout(selectClickTimer)
    selectClickTimer = null
  }
}

const onCardDblClick = (event) => {
  if (props.disableEdit) return
  if (props.note?.isPending || saving.value || isEditing.value) return
  if (event.target.closest(CARD_INTERACTIVE_SELECTOR)) return
  clearSelectClickTimer()
  enterEdit()
}

const onSelectableCardClick = (event) => {
  if (!props.selectable || props.note?.isPending) return
  if (event.target.closest(CARD_INTERACTIVE_SELECTOR)) return
  clearSelectClickTimer()
  selectClickTimer = setTimeout(() => {
    selectClickTimer = null
    emit('toggle-select')
  }, 220)
}

function formatTime(dateValue) {
  if (!dateValue) return '----'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '----'
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}
</script>

<style scoped>
.note-card {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: #ffffff;
}

.note-card.is-selectable {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.note-card.is-selectable.is-selected {
  background: rgba(24, 24, 27, 0.04);
  border-color: rgba(24, 24, 27, 0.22);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.note-select-control {
  flex: 0 0 auto;
  margin-top: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.note-select-box {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: #ffffff;
  box-sizing: border-box;
  transform-origin: center;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.note-select-box svg {
  display: block;
  flex-shrink: 0;
}

.note-select-box.is-checked {
  border-color: #18181b;
  background: #18181b;
}

.note-select-box--remove {
  border-color: #18181b;
  background: #18181b;
  color: #ffffff;
}

.note-card.is-selection-removable:hover .note-select-box--remove,
.note-card.is-selection-removable:focus-within .note-select-box--remove {
  background: #3f3f46;
  border-color: #3f3f46;
}

.note-card-main {
  flex: 1;
  min-width: 0;
}

.note-card:hover,
.note-card:focus-within {
  border-color: rgba(200, 200, 200, 0.45);
}

.note-card.is-selectable.is-selected:hover,
.note-card.is-selectable.is-selected:focus-within {
  border-color: rgba(24, 24, 27, 0.32);
}

.note-card.is-editing {
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
}

.note-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.meta-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.note-tag {
  display: inline-block;
  padding: 2px 8px;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.2px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

button.note-tag:hover {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-accent);
}

button.note-tag:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.note-tag-ai-loading {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-secondary-text);
}

.note-tag-ai-spinner {
  flex: 0 0 auto;
  animation: note-tag-ai-spin 0.85s linear infinite;
}

.note-tag-ai-loading-text {
  font-size: 12px;
}

@keyframes note-tag-ai-spin {
  to {
    transform: rotate(360deg);
  }
}

.pin-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.pin-badge-top {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-accent);
}

.pin-badge-bottom {
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
}

.note-card.is-pinned-top {
  background: linear-gradient(
    180deg,
    rgba(37, 99, 235, 0.04) 0%,
    transparent 60%
  );
}

.note-card.is-pinned-top::before {
  content: '';
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--color-accent);
}

.note-card.is-pinned-bottom {
  background: rgba(24, 24, 27, 0.015);
}

.icon-btn.is-active {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-accent);
}

.icon-btn.is-active:hover {
  background: rgba(37, 99, 235, 0.18);
  color: var(--color-accent);
}

.pin-icon-top {
  transform: rotate(180deg);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  min-height: 28px;
  padding: 4px 8px 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  transform-origin: left center;
}

.tag-chip-label {
  font-weight: 600;
}

.tag-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.tag-chip-remove:hover:not(:disabled) {
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.08);
}

.tag-hash-menu-state {
  margin: 0;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.tag-hash-menu-hash {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.note-time {
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.meta-right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.meta-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transform: translateY(-1px);
}

.recall-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  flex-shrink: 0;
  color: var(--color-accent);
  opacity: 1;
  cursor: pointer;
}

.recall-indicator:hover {
  background: rgba(37, 99, 235, 0.08);
}

.recall-indicator:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.note-card:hover .meta-actions,
.note-card:focus-within .meta-actions,
.note-card.is-editing .meta-actions {
  opacity: 1;
  transform: translateY(0);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.icon-btn:hover {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-text);
}

.icon-btn-danger:hover {
  background: rgba(220, 38, 38, 0.08);
  color: var(--color-error);
}

.note-card :deep(p) {
  margin: 0;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.note-content-root {
  width: 100%;
  cursor: text;
}

.note-content-root :deep(.tiptap-content .ProseMirror) {
  font-size: 14px;
  line-height: 1.6;
}

.note-content-root :deep(.tiptap-content .ProseMirror > :last-child) {
  margin-bottom: 0;
}

.note-content-root :deep(.tiptap-content .ProseMirror ul),
.note-content-root :deep(.tiptap-content .ProseMirror ol) {
  margin: 0;
  padding-left: 1.25em;
}

.note-content-root :deep(.tiptap-content .ProseMirror li) {
  margin: 0;
}

.note-content-root :deep(.tiptap-content .ProseMirror li + li) {
  margin-top: 0.15em;
}

.note-content-root :deep(.tiptap-content .ProseMirror ul[data-type='taskList']) {
  margin: 0;
  padding-left: 0;
}

.note-content-root :deep(.tiptap-content .ProseMirror ul[data-type='taskList'] li label) {
  margin-top: 0.05em;
}

.note-content-root :deep(.tiptap-content .ProseMirror > p:last-child:empty),
.note-content-root :deep(.tiptap-content .ProseMirror > p:last-child:has(> br:only-child)) {
  margin: 0;
  min-height: 0;
  height: 0;
  overflow: hidden;
}

.note-content-root :deep(.tiptap-preview) {
  margin: 0;
}

.note-card :deep(mark.note-highlight) {
  background: rgba(37, 99, 235, 0.16);
  color: var(--color-accent);
  font-weight: 600;
  border-radius: 3px;
  padding: 0 2px;
  margin: 0 -1px;
}

.note-text-fallback {
  margin: 0;
  color: var(--color-secondary-text);
  font-size: 13px;
}

/* === Markdown 代码块：白色主题 === */
.note-card :deep(.ProseMirror pre) {
  background: #fafafa !important;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
}

.note-card :deep(.ProseMirror pre code) {
  background: transparent !important;
}

/* === 编辑器：无装饰原地编辑 === */
.note-editor {
  display: block;
  width: 100%;
  max-height: 480px;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  resize: none;
  overflow-y: auto;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  scrollbar-width: thin;
  box-sizing: border-box;
}

.note-editor:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.editor-attachment-strip {
  margin-top: 12px;
}

.note-card.is-compact :deep(.file-list) {
  margin-top: 6px;
}

.note-card.is-compact :deep(.file-chip) {
  min-height: 28px;
  padding: 3px 8px;
}

.note-card.is-compact :deep(.file-chip-name) {
  font-size: 10px;
}

.note-card.is-compact :deep(.file-chip-ext) {
  font-size: 9px;
}

.thumb-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  width: 100%;
}

.thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: visible;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 7px;
  display: block;
}

.thumb-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.85);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

.thumb-remove:hover:not(:disabled) {
  background: #18181b;
}

.thumb-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.thumb-add {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  flex-shrink: 0;
}

.hidden-file-input {
  display: none;
}

.counter {
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
  font-size: 12px;
}

.counter-divider {
  color: #a1a1aa;
  margin: 0 1px;
}

.counter-full {
  color: #d97706;
  font-weight: 500;
}

@keyframes thumb-pop {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.editor-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--color-border);
}

.editor-bar-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.editor-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-secondary-text);
  font-size: 11px;
}

.editor-hint kbd {
  display: inline-block;
  min-width: 22px;
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}

.hint-plus {
  color: #a1a1aa;
}

.hint-text {
  margin-left: 2px;
}

.editor-bar-right {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.link-btn {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-secondary-text);
  font-size: 13px;
  cursor: pointer;
}

.link-btn:hover:not(:disabled) {
  color: var(--color-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* === 骨架屏 === */
.skeleton-line {
  height: 12px;
  border-radius: 6px;
  margin-top: 8px;
  background: linear-gradient(90deg, #ececf0 25%, #f5f5f7 37%, #ececf0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.3s ease infinite;
}

.w-70 {
  width: 70%;
}

.w-85 {
  width: 85%;
}

.w-100 {
  width: 100%;
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.note-card.is-compact {
  padding: 8px 10px;
  border-radius: 9px;
  border-color: var(--color-border);
  background: rgba(255, 255, 255, 0.72);
}

.note-card.is-compact .note-meta {
  margin-bottom: 6px;
  gap: 8px;
}

.note-card.is-compact .note-tag {
  font-size: var(--fragments-list-tag-font, 11px);
  padding: 1px 6px;
  line-height: 1.45;
}

.note-card.is-compact .note-time {
  font-size: var(--fragments-list-time-font, 10px);
}

.note-card.is-compact .note-content-root :deep(.tiptap-content .ProseMirror) {
  font-size: var(--fragments-list-font-size, 11px);
  line-height: var(--fragments-list-line-height, 1.55);
}

.note-card.is-compact .note-text-fallback {
  font-size: var(--fragments-list-font-size, 11px);
  line-height: var(--fragments-list-line-height, 1.55);
}

.note-card.is-compact :deep(.ProseMirror pre) {
  padding: 8px 10px;
  font-size: 10px;
}

.note-card.is-compact :deep(.gallery) {
  margin-top: 6px;
}

.note-card.is-compact :deep(.tile) {
  width: var(--fragments-list-tile-size, 67px);
  height: var(--fragments-list-tile-size, 67px);
}

.note-card.is-compact :deep(.tile-overlay) {
  width: 20px;
  height: 20px;
}

.note-card.is-compact.is-selectable .note-select-control {
  margin-top: 1px;
}

.note-card.is-compact.is-selectable .note-select-box {
  width: 15px;
  height: 15px;
}
</style>
