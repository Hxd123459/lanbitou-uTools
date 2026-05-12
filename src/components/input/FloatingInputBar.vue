<template>
  <div
    class="input-bar"
    :class="{ 'is-submitting': submitting, 'is-searching': isSearchMode }"
  >
    <div class="input-shell">
      <textarea
        v-if="!isSearchMode"
        ref="textareaRef"
        :value="modelValue"
        class="main-input"
        :disabled="submitting"
        :placeholder="placeholder"
        rows="1"
        @input="onInput"
        @keydown="onKeydown"
        @paste="onPaste"
      />

      <div v-else class="search-input-row">
        <svg
          class="search-input-icon"
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
        <input
          ref="searchInputRef"
          v-model="searchKeyword"
          class="main-input search-input"
          type="search"
          :placeholder="searchPlaceholder"
          :maxlength="SEARCH_MAX_LEN"
          autocomplete="off"
          spellcheck="false"
          @keydown="onSearchKeydown"
          @input="onSearchInput"
        />
        <button
          v-if="searchKeyword"
          type="button"
          class="search-clear"
          aria-label="清空关键词"
          title="清空"
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
        </button>
      </div>

      <div v-if="!isSearchMode && images.length" class="thumb-strip">
        <div v-for="item in images" :key="item.id" class="thumb">
          <img :src="item.url" alt="预览" />
          <button
            type="button"
            class="thumb-remove"
            :disabled="submitting"
            aria-label="移除图片"
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
          </button>
        </div>

        <button
          v-if="!submitting && images.length < MAX_IMAGES"
          type="button"
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
        </button>
      </div>

      <div
        v-if="!isSearchMode && showProgress"
        class="upload-progress"
        role="progressbar"
        :aria-valuenow="progressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="upload-progress-bar" :style="{ width: `${progressPercent}%` }"></div>
      </div>

      <div class="input-footer">
        <div class="footer-left">
          <template v-if="!isSearchMode">
            <button
              type="button"
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
            </button>
            <button
              type="button"
              class="btn btn-icon"
              :disabled="submitting"
              title="搜索笔记"
              aria-label="搜索笔记"
              @click="enterSearchMode"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="btn btn-icon"
              title="退出搜索（Esc）"
              aria-label="退出搜索"
              @click="exitSearchMode"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M15 6l-6 6 6 6"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
              </svg>
            </button>
          </template>
        </div>

        <div class="footer-right">
          <template v-if="!isSearchMode">
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
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!canSubmit"
              @click="onSubmit"
            >
              保存
            </button>
          </template>
          <template v-else>
            <span v-if="searchLoading" class="status">搜索中…</span>
            <span class="hint">
              <span class="hint-text">输入即搜</span>
              <span class="hint-plus">·</span>
              <kbd>Esc</kbd>
              <span class="hint-text">退出</span>
            </span>
          </template>
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
  'search',
  'search-cancel',
])

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


const adjustHeight = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(el.scrollHeight, MAX_HEIGHT)
  el.style.height = `${next}px`
}

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
  nextTick(adjustHeight)
}

const onKeydown = (event) => {
  if (event.isComposing) return
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
  const remaining = MAX_IMAGES - images.value.length
  if (remaining <= 0) {
    emit('limit-exceeded', MAX_IMAGES)
    return
  }
  const accepted = files.slice(0, remaining)
  accepted.forEach((file) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    images.value.push({ id, file, url: URL.createObjectURL(file) })
  })
  if (files.length > remaining) emit('limit-exceeded', MAX_IMAGES)
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
  isSearchMode.value = true
  nextTick(() => searchInputRef.value?.focus())
}

const exitSearchMode = () => {
  if (!isSearchMode.value) return
  cancelSearchDebounce()
  isSearchMode.value = false
  searchKeyword.value = ''
  emit('search-cancel')
  nextTick(() => {
    textareaRef.value?.focus()
    adjustHeight()
  })
}

const clearSearchKeyword = () => {
  searchKeyword.value = ''
  cancelSearchDebounce()
  emit('search-cancel')
  nextTick(() => searchInputRef.value?.focus())
}

const onSearchInput = () => {
  if (searchKeyword.value.length > SEARCH_MAX_LEN) {
    searchKeyword.value = searchKeyword.value.slice(0, SEARCH_MAX_LEN)
  }
  dispatchSearch(false)
}

const onSearchKeydown = (event) => {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    exitSearchMode()
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
  transition: border-color var(--motion-fast),
    box-shadow var(--motion-fast);
}

.input-shell:focus-within {
  border-color: var(--color-accent);
  box-shadow: var(--focus-ring), var(--shadow-float);
}

.is-submitting .input-shell {
  opacity: 0.85;
}

.main-input {
  width: 100%;
  min-height: 56px;
  max-height: 280px;
  height: 56px;
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
  transition: min-height var(--motion-fast);
}

.input-shell:focus-within .main-input {
  min-height: 112px;
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

.search-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 14px 6px 16px;
  min-height: 56px;
}

.search-input-icon {
  color: var(--color-secondary-text);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-height: auto;
  height: auto;
  padding: 0;
  font-size: 15px;
  line-height: 1.55;
  appearance: none;
  -webkit-appearance: none;
}

.search-input::-webkit-search-cancel-button,
.search-input::-webkit-search-decoration {
  -webkit-appearance: none;
  appearance: none;
}

.search-clear {
  flex-shrink: 0;
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
  transition: background var(--motion-fast), color var(--motion-fast);
}

.search-clear:hover {
  background: rgba(24, 24, 27, 0.18);
  color: var(--color-primary);
}

.is-searching .input-shell:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(24, 24, 27, 0.08), var(--shadow-float);
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
  animation: thumb-pop var(--motion-fast) ease-out;
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
  transition: background var(--motion-fast), transform var(--motion-fast);
}

.thumb-remove:hover {
  background: #18181b;
  transform: scale(1.08);
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
  animation: thumb-pop var(--motion-fast) ease-out;
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
  transition: width 120ms linear;
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

@media (prefers-reduced-motion: reduce) {
  .thumb,
  .thumb-add {
    animation: none;
  }
  .thumb-remove,
  .upload-progress-bar {
    transition: none;
  }
}
</style>
