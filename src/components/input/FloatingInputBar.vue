<template>
  <div class="input-bar" :class="{ 'is-submitting': submitting }">
    <div class="input-shell">
      <div class="input-shell-stack">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          class="main-input"
          :disabled="submitting"
          :placeholder="resolvedPlaceholder"
          rows="1"
          :style="{ height: inputHeight + 'px' }"
          @input="onInput"
          @focus="onFocus"
          @blur="onBlur"
          @keydown="onKeydown"
          @paste="onPaste"
          @click="onCaretChange"
          @keyup="onCaretChange"
        />

        <div v-if="stripItems.length" class="thumb-strip">
          <motion.div
            v-for="item in stripItems"
            :key="item.key"
            class="thumb"
            :initial="presets.thumbPop.initial"
            :animate="presets.thumbPop.animate"
            :transition="presets.thumbPop.transition"
          >
            <img
              v-if="item.kind === 'image'"
              :src="item.previewUrl || item.url"
              alt="预览"
              draggable="false"
            />
            <div v-else class="thumb-file">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span class="thumb-file-name" :title="item.name">
                {{ truncateFileName(item.name, 8) }}
              </span>
            </div>
            <motion.button
              type="button"
              class="thumb-remove"
              :disabled="submitting"
              :aria-label="item.kind === 'image' ? '移除图片' : '移除附件'"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="removeAttachment(item.key)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  fill="none"
                />
              </svg>
            </motion.button>
          </motion.div>
        </div>

        <div
          v-if="showProgress"
          class="upload-progress"
          role="progressbar"
          :aria-valuenow="progressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <motion.div
            class="upload-progress-bar"
            :animate="{ width: `${progressPercent}%` }"
            :transition="{ duration: 0.12, ease: 'linear' }"
          />
        </div>
      </div>

      <div class="input-footer">
        <div class="footer-left">
          <AnimatePresence mode="wait">
            <motion.span
              v-if="effectiveTag"
              :key="effectiveTag.tagId || effectiveTag.tagName"
              class="tag-chip"
              :initial="presets.swapLabel.initial"
              :animate="presets.swapLabel.animate"
              :exit="presets.swapLabel.exit"
              :transition="presets.swapLabel.transition"
            >
              <span class="tag-chip-label">#{{ effectiveTag.tagName }}</span>
              <motion.button
                type="button"
                class="tag-chip-remove"
                :disabled="submitting"
                :aria-label="isContextTagActive ? '移除标签，本条将记为待整理' : '移除标签'"
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
            :disabled="submitting || !canAddImage"
            :title="canAddImage ? '从本地选择图片' : `最多 ${MAX_ATTACHMENTS} 个附件`"
            aria-label="选择本地图片"
            @click="openImagePicker"
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
            :disabled="submitting || !canAddFile"
            :title="canAddFile ? '从本地选择附件' : `最多 ${MAX_ATTACHMENTS} 个附件`"
            aria-label="选择本地附件"
            @click="openFilePicker"
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
        </div>

        <div class="footer-right">
          <span
            v-if="attachmentCount"
            class="counter"
            :class="{ 'counter-full': attachmentCount >= MAX_ATTACHMENTS }"
          >
            {{ attachmentCount }}<span class="counter-divider">/</span>{{ MAX_ATTACHMENTS }}
          </span>
          <span v-if="submitting" class="status">
            {{ showProgress ? `上传中 ${progressPercent}%` : '提交中…' }}
          </span>
          <span class="hint">
            <kbd>{{ shortcutLabel }}</kbd>
            <span class="hint-plus">+</span>
            <kbd>Enter</kbd>
          </span>
          <AppButton
            class="btn btn-primary"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            保存
          </AppButton>
        </div>
      </div>

      <input
        ref="imageInputRef"
        type="file"
        accept="image/*"
        multiple
        class="hidden-file-input"
        @change="onImagePicked"
      />
      <input
        ref="fileInputRef"
        type="file"
        multiple
        class="hidden-file-input"
        @change="onFilePicked"
      />
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
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { MAX_ATTACHMENTS } from '../../constants/uploadLimits'
import { useAttachmentDraft } from '../../composables/useAttachmentDraft'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useTagHashPicker } from '../../composables/useTagHashPicker'
import { markClipboardImageHandledByPaste } from '../../composables/useUtoolsClipboardEnter'
import { truncateFileName } from '../../utils/attachmentDisplay'
import {
  extractClipboardPasteFiles,
  insertTextAtTextareaCursor,
} from '../../utils/tiptapImageInsert'
import AppButton from '../motion/AppButton.vue'
import '../../assets/styles/tiptap-slash-menu.css'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '记录此刻想法 ，使用#用或者加标签',
  },
  uploadProgress: {
    type: Number,
    default: 0,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  /** 列表按标签筛选时传入，新建碎片默认带上该标签 */
  contextTag: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'update:modelValue',
  'submit',
  'limit-exceeded',
  'image-too-large',
  'file-too-large',
])

const { presets } = useMotionPresets()

const MIN_HEIGHT = 80
const MAX_HEIGHT = 280

const textareaRef = ref(null)
const imageInputRef = ref(null)
const fileInputRef = ref(null)
const isMac = ref(false)
const {
  items: attachmentItems,
  stripItems: buildStripItems,
  remaining: remainingAttachmentSlots,
  appendFiles,
  removeItem: removeAttachmentItem,
  resetItems: resetAttachments,
  getNewFiles,
} = useAttachmentDraft({ maxCount: MAX_ATTACHMENTS })
const inputHeight = ref(MIN_HEIGHT)
const initialHeight = ref(MIN_HEIGHT)
const savedHeight = ref(null)
const isFocused = ref(false)
const selectedTag = ref(null)
const contextTagDismissed = ref(false)

const effectiveTag = computed(() => {
  if (selectedTag.value) return selectedTag.value
  if (props.contextTag && !contextTagDismissed.value) return props.contextTag
  return null
})

const isContextTagActive = computed(
  () => !!props.contextTag && !contextTagDismissed.value && !selectedTag.value,
)

const DEFAULT_PLACEHOLDER = '记录此刻想法 ，使用#用或者加标签'

const resolvedPlaceholder = computed(() => {
  if (props.placeholder !== DEFAULT_PLACEHOLDER) return props.placeholder
  if (isContextTagActive.value && props.contextTag?.tagName) {
    return `在 #${props.contextTag.tagName} 下记录…`
  }
  return props.placeholder
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
  getText: () => props.modelValue,
  setText: (value) => emit('update:modelValue', value),
  getTextarea: () => textareaRef.value,
  onTagSelected: (tag) => {
    selectedTag.value = tag
  },
})

const shortcutLabel = computed(() => (isMac.value ? '⌘' : 'Ctrl'))
const progressPercent = computed(() =>
  Math.max(0, Math.min(100, Math.round((props.uploadProgress || 0) * 100))),
)
const showProgress = computed(
  () => props.submitting && attachmentCount.value > 0 && progressPercent.value < 100,
)
const attachmentCount = computed(() => attachmentItems.value.length)
const stripItems = computed(() => buildStripItems())
const canAddImage = computed(
  () => !props.submitting && remainingAttachmentSlots() > 0,
)
const canAddFile = computed(
  () => !props.submitting && remainingAttachmentSlots() > 0,
)
const canSubmit = computed(
  () =>
    !props.submitting &&
    (props.modelValue.trim().length > 0 || attachmentCount.value > 0),
)

const measureHeight = (el) => {
  inputHeight.value = MIN_HEIGHT
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const next = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
      inputHeight.value = next
      resolve(next)
    })
  })
}

const adjustHeight = async () => {
  const el = textareaRef.value
  if (!el) return
  await measureHeight(el)
}

const onFocus = () => {
  isFocused.value = true
  nextTick(adjustHeight)
}

const onBlur = () => {
  isFocused.value = false
  onTagTextareaBlur()
  nextTick(async () => {
    if (!props.modelValue.trim() && !attachmentCount.value) {
      inputHeight.value = MIN_HEIGHT
      return
    }
    await adjustHeight()
  })
}

const onCaretChange = () => {
  nextTick(() => syncTagMenu())
}

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
  nextTick(async () => {
    await adjustHeight()
    await syncTagMenu()
  })
}

const clearSelectedTag = () => {
  if (selectedTag.value) {
    selectedTag.value = null
    return
  }
  contextTagDismissed.value = true
}

const onKeydown = (event) => {
  if (event.isComposing) return
  if (handleTagMenuKeyDown(event)) return
  if (event.key !== 'Enter') return
  const modifierPressed = isMac.value ? event.metaKey : event.ctrlKey
  if (!modifierPressed) return
  event.preventDefault()
  onSubmit()
}

const handleAppendResult = (result) => {
  if (result.imageTooLarge) emit('image-too-large')
  if (result.fileTooLarge) emit('file-too-large')
  if (result.limitExceeded) emit('limit-exceeded', MAX_ATTACHMENTS)
  if (result.accepted) nextTick(adjustHeight)
}

const onPaste = (event) => {
  if (props.submitting) return
  if (document.activeElement !== textareaRef.value) return
  const clipboardData = event.clipboardData
  if (!clipboardData) return

  const files = extractClipboardPasteFiles(clipboardData)
  if (!files.length) return

  event.preventDefault()
  markClipboardImageHandledByPaste()

  const plain = clipboardData.getData('text/plain')
  if (plain) {
    insertTextAtTextareaCursor(
      textareaRef.value,
      props.modelValue,
      plain,
      (value) => emit('update:modelValue', value),
    )
  }

  handleAppendResult(appendFiles(files))
}

const openImagePicker = () => {
  if (props.submitting || !canAddImage.value) {
    if (!canAddImage.value) emit('limit-exceeded', MAX_ATTACHMENTS)
    return
  }
  imageInputRef.value?.click()
}

const openFilePicker = () => {
  if (props.submitting || !canAddFile.value) {
    if (!canAddFile.value) emit('limit-exceeded', MAX_ATTACHMENTS)
    return
  }
  fileInputRef.value?.click()
}

const onImagePicked = (event) => {
  const picked = Array.from(event.target.files || [])
  if (picked.length) handleAppendResult(appendFiles(picked))
  event.target.value = ''
}

const onFilePicked = (event) => {
  const picked = Array.from(event.target.files || [])
  if (picked.length) handleAppendResult(appendFiles(picked))
  event.target.value = ''
}

const removeAttachment = (key) => {
  removeAttachmentItem(key)
  nextTick(adjustHeight)
}

const addImages = (files) => {
  handleAppendResult(appendFiles(files))
}

const reset = () => {
  resetAttachments()
  selectedTag.value = null
  closeTagMenu()
  inputHeight.value = MIN_HEIGHT
}

const focus = () => {
  if (props.submitting) return
  textareaRef.value?.focus()
}

const onSubmit = () => {
  if (props.submitting) return
  const text = props.modelValue
  if (!text.trim() && attachmentCount.value === 0) return
  emit('submit', {
    text,
    images: getNewFiles(),
    tagId: effectiveTag.value?.tagId ?? null,
    tagName: effectiveTag.value?.tagName ?? '',
  })
}

watch(
  () => props.contextTag?.tagId,
  () => {
    contextTagDismissed.value = false
    selectedTag.value = null
  },
)

watch(
  () => props.modelValue,
  () => {
    if (isFocused.value) nextTick(adjustHeight)
  },
)

watch(
  () => attachmentCount.value,
  () => nextTick(adjustHeight),
)

watch(
  () => props.compact,
  (isCompact) => {
    if (isCompact) {
      if (savedHeight.value === null) savedHeight.value = inputHeight.value
      inputHeight.value = initialHeight.value
      return
    }
    if (savedHeight.value !== null) {
      inputHeight.value = savedHeight.value
      savedHeight.value = null
    }
    nextTick(adjustHeight)
  },
)

onMounted(() => {
  const platform =
    (typeof navigator !== 'undefined' &&
      (navigator.userAgentData?.platform || navigator.platform || '')) ||
    ''
  isMac.value = /Mac|iPhone|iPad|iPod/i.test(platform)
  loadTags()
  nextTick(async () => {
    await adjustHeight()
    initialHeight.value = inputHeight.value
  })
})

onBeforeUnmount(() => {
  resetAttachments()
})

defineExpose({ reset, addImages, focus })
</script>

<style scoped>
.input-bar {
  display: flex;
  flex-direction: column;
}

.input-shell {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.input-shell:focus-within {
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring), var(--shadow-float);
}

.is-submitting .input-shell {
  opacity: 0.85;
}

.input-shell-stack {
  display: flex;
  flex-direction: column;
  flex: 0 1 auto;
  min-height: 0;
  width: 100%;
}

.main-input {
  width: 100%;
  max-height: 280px;
  border: 0;
  outline: 0;
  resize: none;
  overflow-y: auto;
  background: transparent;
  color: var(--color-text);
  padding: 14px 16px 6px;
  font-size: 15px;
  line-height: 1.55;
  font-family: inherit;
  scrollbar-width: none;
  box-sizing: border-box;
}

.main-input::-webkit-scrollbar {
  display: none;
}

.main-input::placeholder {
  color: #a1a1aa;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  transform-origin: left center;
  min-height: 28px;
  padding: 4px 8px 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
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

.main-input:disabled {
  cursor: not-allowed;
}

.thumb-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 16px 10px;
}

.thumb {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: visible;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 5px;
  display: block;
}

.thumb-file {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  box-sizing: border-box;
  color: var(--color-accent);
}

.thumb-file-name {
  max-width: 100%;
  font-size: 9px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  color: var(--color-secondary-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb-remove {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
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

.thumb-remove:hover {
  background: #18181b;
}

.thumb-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-progress {
  height: 2px;
  width: 100%;
  background: rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.upload-progress-bar {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px 10px;
  color: var(--color-secondary-text);
  font-size: 12px;
}

.footer-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
}

.footer-left .btn-icon {
  border-color: transparent;
  background: transparent;
}

.footer-left .btn-icon:hover:not(:disabled) {
  border-color: transparent;
  background: var(--btn-icon-bg-hover);
  color: var(--btn-icon-color-hover);
}

.footer-left .btn-icon:focus-visible {
  border-color: transparent;
  background: var(--btn-icon-bg-hover);
  color: var(--btn-icon-color-hover);
  box-shadow: var(--focus-ring);
}

.hidden-file-input {
  display: none;
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.hint-plus {
  color: #a1a1aa;
}

.hint kbd {
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

.footer-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 30px;
}

.counter {
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
}

.counter-divider {
  color: #a1a1aa;
  margin: 0 1px;
}

.counter-full {
  color: #d97706;
  font-weight: 500;
}

.status {
  color: var(--color-accent);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
</style>
