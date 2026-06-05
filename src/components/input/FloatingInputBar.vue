<template>
  <div class="input-bar" :class="{ 'is-submitting': submitting }">
    <div class="input-shell">
      <div class="input-shell-stack">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          class="main-input"
          :disabled="submitting"
          :placeholder="placeholder"
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

        <div v-if="images.length" class="thumb-strip">
          <motion.div
            v-for="item in images"
            :key="item.id"
            class="thumb"
            :initial="presets.thumbPop.initial"
            :animate="presets.thumbPop.animate"
            :transition="presets.thumbPop.transition"
          >
            <img :src="item.url" alt="预览" />
            <motion.button
              type="button"
              class="thumb-remove"
              :disabled="submitting"
              aria-label="移除图片"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="removeImage(item.id)"
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

          <AppButton
            v-if="!submitting && images.length < MAX_IMAGES"
            class="btn btn-dashed-tile thumb-add"
            aria-label="添加图片"
            title="继续添加图片"
            @click="openFilePicker"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                fill="none"
              />
            </svg>
          </AppButton>
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
          <AnimatePresence>
            <motion.span
              v-if="selectedTag"
              :key="selectedTag.tagId"
              class="tag-chip"
              :initial="presets.reveal.initial"
              :animate="presets.reveal.animate"
              :exit="presets.reveal.exit"
              :transition="presets.reveal.transition"
            >
              <span class="tag-chip-label">#{{ selectedTag.tagName }}</span>
              <motion.button
                type="button"
                class="tag-chip-remove"
                :disabled="submitting"
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
            :disabled="submitting || images.length >= MAX_IMAGES"
            :title="
              images.length >= MAX_IMAGES
                ? `最多 ${MAX_IMAGES} 张`
                : '从本地选择图片'
            "
            aria-label="选择本地图片"
            @click="openFilePicker"
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
        </div>

        <div class="footer-right">
          <span
            v-if="images.length"
            class="counter"
            :class="{ 'counter-full': images.length >= MAX_IMAGES }"
          >
            {{ images.length }}<span class="counter-divider">/</span>{{ MAX_IMAGES }}
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
        ref="fileInputRef"
        type="file"
        accept="image/*"
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
import { isImageFileSizeAllowed } from '../../constants/uploadLimits'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useTagHashPicker } from '../../composables/useTagHashPicker'
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
    default: '记录此刻想法 ，使用#使用或者添加标签',
  },
  uploadProgress: {
    type: Number,
    default: 0,
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:modelValue',
  'submit',
  'limit-exceeded',
  'image-too-large',
])

const { presets } = useMotionPresets()

const MIN_HEIGHT = 80
const MAX_HEIGHT = 280
const MAX_IMAGES = 20

const textareaRef = ref(null)
const fileInputRef = ref(null)
const isMac = ref(false)
const images = ref([])
const inputHeight = ref(MIN_HEIGHT)
const initialHeight = ref(MIN_HEIGHT)
const savedHeight = ref(null)
const isFocused = ref(false)
const selectedTag = ref(null)

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
  () => props.submitting && images.value.length > 0 && progressPercent.value < 100,
)
const canSubmit = computed(
  () =>
    !props.submitting &&
    (props.modelValue.trim().length > 0 || images.value.length > 0),
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
    if (!props.modelValue.trim() && !images.value.length) {
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
  selectedTag.value = null
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

const onPaste = (event) => {
  if (props.submitting) return
  const items = Array.from(event.clipboardData?.items || [])
  const files = items
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)

  if (!files.length) return
  event.preventDefault()
  addImages(files)
}

const openFilePicker = () => {
  if (props.submitting) return
  if (images.value.length >= MAX_IMAGES) {
    emit('limit-exceeded', MAX_IMAGES)
    return
  }
  fileInputRef.value?.click()
}

const onFilePicked = (event) => {
  const picked = Array.from(event.target.files || []).filter((f) =>
    f.type.startsWith('image/'),
  )
  if (picked.length) addImages(picked)
  event.target.value = ''
}

const addImages = (files) => {
  const tooBig = files.filter((f) => !isImageFileSizeAllowed(f))
  if (tooBig.length) emit('image-too-large')
  const ok = files.filter((f) => isImageFileSizeAllowed(f))
  const remaining = MAX_IMAGES - images.value.length
  if (remaining <= 0) {
    emit('limit-exceeded', MAX_IMAGES)
    return
  }
  const accepted = ok.slice(0, remaining)
  accepted.forEach((file) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    images.value.push({ id, file, url: URL.createObjectURL(file) })
  })
  if (ok.length > remaining) emit('limit-exceeded', MAX_IMAGES)
  nextTick(adjustHeight)
}

const removeImage = (id) => {
  const idx = images.value.findIndex((item) => item.id === id)
  if (idx === -1) return
  URL.revokeObjectURL(images.value[idx].url)
  images.value.splice(idx, 1)
  nextTick(adjustHeight)
}

const reset = () => {
  images.value.forEach((item) => URL.revokeObjectURL(item.url))
  images.value = []
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
  if (!text.trim() && images.value.length === 0) return
  emit('submit', {
    text,
    images: images.value.map((item) => item.file),
    tagId: selectedTag.value?.tagId ?? null,
    tagName: selectedTag.value?.tagName ?? '',
  })
}

watch(
  () => props.modelValue,
  () => {
    if (isFocused.value) nextTick(adjustHeight)
  },
)

watch(
  () => images.value.length,
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
  images.value.forEach((item) => URL.revokeObjectURL(item.url))
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
  gap: 8px;
  padding: 6px 16px 10px;
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

.thumb-remove:hover {
  background: #18181b;
}

.thumb-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.thumb-add {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  flex-shrink: 0;
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
