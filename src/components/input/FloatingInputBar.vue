<template>
  <div class="input-bar" :class="{ 'is-submitting': submitting }">
    <div class="input-shell">
      <div class="input-shell-stack">
        <AnimatePresence mode="wait">
          <motion.div
            v-if="!isSearchMode"
            key="write"
            class="input-mode-panel"
            :initial="presets.reveal.initial"
            :animate="presets.reveal.animate"
            :exit="presets.reveal.exit"
            :transition="presets.reveal.transition"
          >
            <textarea
              ref="textareaRef"
              :value="modelValue"
              class="main-input"
              :disabled="submitting"
              :placeholder="placeholder"
              rows="1"
              :style="{ height: inputHeight + 'px' }"
              @input="onInput"
              @blur="onWriteBlur"
              @keydown="onKeydown"
              @paste="onPaste"
            />
          </motion.div>

          <motion.div
            v-else
            key="search"
            class="search-field-wrap input-mode-panel"
            :initial="presets.reveal.initial"
            :animate="presets.reveal.animate"
            :exit="presets.reveal.exit"
            :transition="presets.reveal.transition"
          >
            <textarea
              ref="searchInputRef"
              v-model="searchKeyword"
              class="main-input search-input"
              rows="1"
              :class="{ 'search-input--clearable': searchKeyword }"
              :placeholder="searchPlaceholder"
              :maxlength="SEARCH_MAX_LEN"
              :aria-busy="searchLoading"
              :style="{ height: inputHeight + 'px' }"
              autocomplete="off"
              spellcheck="false"
              @keydown="onSearchKeydown"
              @input="onSearchInput"
              @blur="onSearchBlur"
              @paste="onSearchPaste"
            />
            <motion.button
              v-if="searchKeyword"
              type="button"
              class="search-clear"
              aria-label="清空关键词"
              title="清空"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="clearSearchKeyword"
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
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            v-if="!isSearchMode"
            key="write-extras"
            class="write-mode-extras"
            :initial="presets.fade.initial"
            :animate="presets.fade.animate"
            :exit="presets.fade.exit"
            :transition="presets.fade.transition"
          >
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
          </motion.div>
        </AnimatePresence>
      </div>

      <div class="input-footer">
        <div class="footer-left">
          <AppButton
            class="btn btn-icon-text"
            :class="{ 'is-active': isSearchMode }"
            :disabled="submitting"
            :title="isSearchMode ? '切换为记录（Tab）' : '切换为搜索（Tab）'"
            :aria-label="isSearchMode ? '当前：搜索，点击或按 Tab 切换为写' : '当前：记录，点击或按 Tab 切换为搜'"
            @click="toggleSearchMode"
          >
            <AnimatePresence mode="wait">
              <motion.span
                v-if="!isSearchMode"
                key="write"
                class="mode-toggle-inner"
                :initial="presets.swapLabel.initial"
                :animate="presets.swapLabel.animate"
                :exit="presets.swapLabel.exit"
                :transition="presets.swapLabel.transition"
              >
                <svg
                  class="mode-toggle-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <path
                    d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    fill="none"
                  />
                </svg>
                <span class="mode-toggle-label">写</span>
              </motion.span>
              <motion.span
                v-else
                key="search"
                class="mode-toggle-inner"
                :initial="presets.swapLabel.initial"
                :animate="presets.swapLabel.animate"
                :exit="presets.swapLabel.exit"
                :transition="presets.swapLabel.transition"
              >
                <svg
                  class="mode-toggle-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="6.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    fill="none"
                  />
                  <path
                    d="M20 20l-4-4"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
                <span class="mode-toggle-label">搜</span>
              </motion.span>
            </AnimatePresence>
          </AppButton>
          <AnimatePresence mode="wait">
            <motion.div
              v-if="!isSearchMode"
              key="pick"
              :initial="presets.fade.initial"
              :animate="presets.fade.animate"
              :exit="presets.fade.exit"
              :transition="presets.fade.transition"
            >
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
            </motion.div>
          </AnimatePresence>
        </div>

        <div class="footer-right">
          <AnimatePresence mode="wait">
            <motion.div
              v-if="!isSearchMode"
              key="write-actions"
              class="footer-right-group"
              :initial="presets.fade.initial"
              :animate="presets.fade.animate"
              :exit="presets.fade.exit"
              :transition="presets.fade.transition"
            >
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
            </motion.div>
          </AnimatePresence>
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
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { isImageFileSizeAllowed } from '../../constants/uploadLimits'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'

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
    default: '记录此刻想法',
  },
  uploadProgress: {
    type: Number,
    default: 0,
  },
  searchLoading: {
    type: Boolean,
    default: false,
  },
  searchPlaceholder: {
    type: String,
    default: '搜索笔记标题与内容…',
  },
})

const emit = defineEmits([
  'update:modelValue',
  'submit',
  'limit-exceeded',
  'image-too-large',
  'search',
  'search-cancel',
])

const { presets } = useMotionPresets()

const MIN_HEIGHT = 112
const MAX_HEIGHT = 280
const MAX_IMAGES = 20
const SEARCH_MAX_LEN = 50
const SEARCH_DEBOUNCE = 250

const textareaRef = ref(null)
const fileInputRef = ref(null)
const searchInputRef = ref(null)
const isMac = ref(false)
const images = ref([])
const isSearchMode = ref(false)
const searchKeyword = ref('')
/** 进入「搜」前快照正文，切回「写」时恢复 */
const writeDraftSnapshot = ref('')
/** 写/搜共享高度，让 Tab 切换前后视觉无跳动 */
const inputHeight = ref(MIN_HEIGHT)

let searchDebounceTimer = null

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


const getActiveTextarea = () =>
  isSearchMode.value ? searchInputRef.value : textareaRef.value

const adjustHeight = () => {
  const el = getActiveTextarea()
  if (!el) return
  const minH = isSearchMode.value ? 44 : MIN_HEIGHT
  inputHeight.value = minH
  nextTick(() => {
    const next = Math.min(Math.max(el.scrollHeight, minH), MAX_HEIGHT)
    inputHeight.value = next
  })
}

const onWriteBlur = () => {
  nextTick(() => {
    adjustHeight()
    if (!props.modelValue.trim() && !images.value.length) {
      inputHeight.value = MIN_HEIGHT
    }
  })
}

const onSearchBlur = () => {
  nextTick(() => {
    adjustHeight()
    if (!searchKeyword.value.trim()) {
      inputHeight.value = 44
    }
  })
}

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
  nextTick(adjustHeight)
}

const onKeydown = (event) => {
  if (event.isComposing) return
  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault()
    toggleSearchMode()
    return
  }
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
}

const removeImage = (id) => {
  const idx = images.value.findIndex((item) => item.id === id)
  if (idx === -1) return
  URL.revokeObjectURL(images.value[idx].url)
  images.value.splice(idx, 1)
}

const reset = () => {
  images.value.forEach((item) => URL.revokeObjectURL(item.url))
  images.value = []
  nextTick(adjustHeight)
}

const onSubmit = () => {
  if (props.submitting) return
  const text = props.modelValue
  if (!text.trim() && images.value.length === 0) return
  emit('submit', {
    text,
    images: images.value.map((item) => item.file),
  })
}

const cancelSearchDebounce = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
}

const dispatchSearch = (immediate = false) => {
  cancelSearchDebounce()
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    emit('search-cancel')
    return
  }
  if (immediate) {
    emit('search', { keyword })
    return
  }
  searchDebounceTimer = window.setTimeout(() => {
    searchDebounceTimer = null
    emit('search', { keyword })
  }, SEARCH_DEBOUNCE)
}

const enterSearchMode = () => {
  if (props.submitting) return
  writeDraftSnapshot.value = props.modelValue
  isSearchMode.value = true
}

const exitSearchMode = () => {
  if (!isSearchMode.value) return
  cancelSearchDebounce()
  isSearchMode.value = false
  searchKeyword.value = ''
  emit('search-cancel')
  emit('update:modelValue', writeDraftSnapshot.value)
}

const focusActiveInput = () => {
  if (isSearchMode.value) {
    searchInputRef.value?.focus()
  } else {
    textareaRef.value?.focus()
    adjustHeight()
  }
}

const toggleSearchMode = () => {
  if (props.submitting) return
  if (isSearchMode.value) {
    exitSearchMode()
  } else {
    enterSearchMode()
  }
}

const clearSearchKeyword = () => {
  searchKeyword.value = ''
  cancelSearchDebounce()
  emit('search-cancel')
  nextTick(() => searchInputRef.value?.focus())
}

const normalizeSearchKeyword = (raw) => {
  let s = (raw || '').replace(/\r?\n/g, '')
  if (s.length > SEARCH_MAX_LEN) s = s.slice(0, SEARCH_MAX_LEN)
  return s
}

const onSearchInput = () => {
  const next = normalizeSearchKeyword(searchKeyword.value)
  if (next !== searchKeyword.value) {
    searchKeyword.value = next
  }
  dispatchSearch(false)
}

const onSearchPaste = (event) => {
  const items = Array.from(event.clipboardData?.items || [])
  const hasImage = items.some(
    (item) => item.kind === 'file' && item.type.startsWith('image/'),
  )
  if (hasImage) event.preventDefault()
}

const onSearchKeydown = (event) => {
  if (event.isComposing) return
  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault()
    toggleSearchMode()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    dispatchSearch(true)
  }
}

watch(
  () => props.modelValue,
  () => nextTick(adjustHeight),
)

watch(isSearchMode, () => {
  nextTick(() => {
    adjustHeight()
    focusActiveInput()
  })
})

onMounted(() => {
  const platform =
    (typeof navigator !== 'undefined' &&
      (navigator.userAgentData?.platform || navigator.platform || '')) ||
    ''
  isMac.value = /Mac|iPhone|iPad|iPod/i.test(platform)
  nextTick(adjustHeight)
})

onBeforeUnmount(() => {
  images.value.forEach((item) => URL.revokeObjectURL(item.url))
  cancelSearchDebounce()
})

defineExpose({ reset, addImages, exitSearchMode })
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

.input-mode-panel {
  width: 100%;
}

.write-mode-extras {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.main-input {
  width: 100%;
  min-height: 112px;
  max-height: 280px;
  height: 112px;
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
}

.main-input::-webkit-scrollbar {
  display: none;
}

.main-input::placeholder {
  color: #a1a1aa;
}

.main-input:disabled {
  cursor: not-allowed;
}

.search-field-wrap {
  position: relative;
  width: 100%;
}

.search-input {
  display: block;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
}

.search-input--clearable {
  padding-right: 36px;
}

.search-field-wrap .search-clear {
  position: absolute;
  right: 10px;
  top: 18px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.search-field-wrap .search-clear:hover {
  background: rgba(24, 24, 27, 0.18);
  color: var(--color-primary);
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
  gap: 6px;
  min-height: 30px;
}

/* 输入区下方工具按钮（写/搜、选图）默认无边框无底色，悬浮/聚焦才显示 */
.footer-left .btn-icon,
.footer-left .btn-icon-text {
  border-color: transparent;
  background: transparent;
}

.footer-left .btn-icon-text.is-active {
  border-color: transparent;
  background: transparent;
  color: var(--color-secondary-text);
}

.footer-left .btn-icon:hover:not(:disabled),
.footer-left .btn-icon-text:hover:not(:disabled) {
  border-color: transparent;
  background: var(--btn-icon-bg-hover);
  color: var(--btn-icon-color-hover);
}

.footer-left .btn-icon:focus-visible,
.footer-left .btn-icon-text:focus-visible {
  border-color: transparent;
  background: var(--btn-icon-bg-hover);
  color: var(--btn-icon-color-hover);
  box-shadow: var(--focus-ring);
}

.mode-toggle-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mode-toggle-icon {
  flex-shrink: 0;
}

.mode-toggle-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1;
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

.hint-text {
  margin-left: 2px;
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

.footer-right-group {
  display: inline-flex;
  align-items: center;
  gap: 10px;
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
