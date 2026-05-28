<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="note-recall-modal"
        class="recall-modal"
        role="dialog"
        aria-modal="true"
        aria-label="回响"
        :initial="modalMotion.initial"
        :animate="modalMotion.animate"
        :exit="modalMotion.exit"
        :transition="modalMotion.transition"
      >
        <motion.div
          class="recall-modal-backdrop"
          aria-hidden="true"
          :initial="backdropMotion.initial"
          :animate="backdropMotion.animate"
          :exit="backdropMotion.exit"
          :transition="backdropMotion.transition"
          @click="emitClose"
        />

        <motion.button
          type="button"
          class="recall-modal-close"
          aria-label="关闭"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="emitClose"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </motion.button>

        <div class="recall-modal-inner">
          <p v-if="loadError" class="recall-status recall-status-error">{{ loadError }}</p>

          <template v-else-if="recall">
            <div class="recall-stage" :class="{ 'is-detail': showDetail }">
              <motion.div
                v-if="recall.recallText || recallSourceText"
                key="recall-quote-block"
                class="recall-quote-block"
                :class="{ 'is-compact': showDetail }"
                :initial="quoteBlockEnter.initial"
                :animate="quoteBlockMotion.animate"
                :transition="quoteBlockMotion.transition"
              >
                <div v-if="recall.recallText" class="recall-quote-cell">
                  <p class="recall-quote" :class="{ 'is-compact': showDetail }">
                    <span class="recall-quote-mark" aria-hidden="true">“</span>
                    <span class="recall-quote-text">{{ recall.recallText }}</span>
                    <span class="recall-quote-mark" aria-hidden="true">”</span>
                  </p>
                </div>
                <div v-if="recallSourceText" class="recall-source-cell">
                  <p class="recall-source">—— {{ recallSourceText }}</p>
                </div>
              </motion.div>

              <AnimatePresence>
                <motion.div
                  v-if="showDetail"
                  key="recall-detail"
                  class="recall-detail-stack"
                  :initial="contentMotion.initial"
                  :animate="contentMotion.animate"
                  :exit="contentMotion.exit"
                  :transition="contentMotion.transition"
                >
                 <time v-if="createTimeText" class="recall-time" :datetime="recall.createTime">
                    {{ createTimeText }}
                  </time>
                  <div class="recall-content-root">
                    <MarkdownRender
                      v-if="markdownNodes.length"
                      :nodes="markdownNodes"
                      :typewriter="false"
                      :batch-rendering="false"
                      :defer-nodes-until-visible="false"
                      code-block-light-theme="github-light"
                      code-block-dark-theme="github-light"
                      :themes="codeThemes"
                    />
                    <p v-else class="recall-content-fallback">暂无正文</p>
                  </div>
                  <NoteImageGallery
                    v-if="recallImages.length"
                    :images="recallImages"
                    class="recall-image-gallery"
                  />
                 
                </motion.div>
              </AnimatePresence>
            </div>

            <AnimatePresence>
              <motion.button
                v-if="!showDetail"
                key="recall-expand"
                type="button"
                class="recall-expand-btn"
                aria-label="展开完整笔记"
                :initial="{ opacity: 0, y: 12 }"
                :animate="{ opacity: 1, y: 0 }"
                :exit="{ opacity: 0, y: 8, scale: 0.92 }"
                :transition="expandButtonTransition"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                @click="revealDetail"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </motion.button>
            </AnimatePresence>
          </template>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import {
  MarkdownRender,
  getMarkdown,
  parseMarkdownToStructure,
} from 'vue-renderer-markdown'
import { clickNoteMemory, fetchNoteRecall } from '../../api/noteMemory'
import { useMotionPresets } from '../../composables/useMotionPresets'
import NoteImageGallery from './NoteImageGallery.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  aiNoteRecallId: { type: [Number, String], default: null },
})

const emit = defineEmits(['close', 'recall-clicked'])

const { presets, reduced } = useMotionPresets()

const recall = ref(null)
const loading = ref(false)
const loadError = ref('')
const showDetail = ref(false)
let bodyOverflowBeforeOpen = ''

const codeThemes = { light: 'github-light', dark: 'github-light' }
const md = getMarkdown('note-recall-modal')
const modalEase = [0.22, 1, 0.36, 1]

const modalMotion = computed(() => {
  if (reduced.value) {
    return { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
  }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.22, ease: modalEase },
  }
})

const backdropMotion = computed(() => {
  if (reduced.value) {
    return { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
  }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2, ease: modalEase },
  }
})

const quoteBlockEnter = computed(() => ({
  initial: reduced.value ? {} : { opacity: 0, y: 12 },
}))

const quoteBlockMotion = computed(() => {
  if (reduced.value) {
    return { animate: {}, transition: { duration: 0 } }
  }
  if (showDetail.value) {
    return {
      animate: { y: -36, scale: 0.9, opacity: 0.95 },
      transition: { duration: 0.4, ease: modalEase },
    }
  }
  return {
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.56, delay: 0.38, ease: modalEase },
  }
})

const expandButtonTransition = computed(() => {
  if (reduced.value) return { duration: 0 }
  return { duration: 0.48, delay: 0.62, ease: modalEase }
})

const contentMotion = computed(() => {
  if (reduced.value) {
    return {
      initial: {},
      animate: {},
      exit: {},
      transition: { duration: 0 },
    }
  }
  return {
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
    transition: { duration: 0.36, delay: 0.12, ease: modalEase },
  }
})

function trimCodeBlockTrailingNewlines(nodes) {
  if (!Array.isArray(nodes)) return nodes
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (node.type === 'code_block' && typeof node.code === 'string') {
      node.code = node.code.replace(/(?:\r?\n)+$/, '')
    }
    if (Array.isArray(node.children)) trimCodeBlockTrailingNewlines(node.children)
    if (Array.isArray(node.items)) trimCodeBlockTrailingNewlines(node.items)
    if (Array.isArray(node.rows)) trimCodeBlockTrailingNewlines(node.rows)
    if (node.header) trimCodeBlockTrailingNewlines([node.header])
  }
  return nodes
}

const createTimeText = computed(() => formatTime(recall.value?.createTime))
const recallSourceText = computed(() => {
  const days = Number(recall.value?.beforeDays)
  if (!Number.isFinite(days) || days <= 0) return ''
  return `来自${days}天前的回响`
})

const markdownNodes = computed(() => {
  const text = recall.value?.markdownContent || ''
  if (!text) return []
  try {
    return trimCodeBlockTrailingNewlines(parseMarkdownToStructure(text, md))
  } catch (error) {
    console.error('[NoteRecallModal] parse markdown failed:', error)
    return []
  }
})

const recallImages = computed(() =>
  Array.isArray(recall.value?.images) ? recall.value.images : [],
)

function formatTime(dateValue) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

const emitClose = () => emit('close')

const revealDetail = async () => {
  if (showDetail.value) return
  if (props.aiNoteRecallId != null && props.aiNoteRecallId !== '') {
    try {
      await clickNoteMemory(props.aiNoteRecallId)
      emit('recall-clicked', props.aiNoteRecallId)
    } catch {
      // 点击上报失败不阻断展开
    }
  }
  showDetail.value = true
}

const resetState = () => {
  recall.value = null
  loading.value = false
  loadError.value = ''
  showDetail.value = false
}

const loadRecall = async () => {
  if (props.aiNoteRecallId == null || props.aiNoteRecallId === '') return
  loading.value = true
  loadError.value = ''
  try {
    recall.value = await fetchNoteRecall(props.aiNoteRecallId)
  } catch (err) {
    loadError.value = err?.msg || '加载回响失败，请稍后重试'
    recall.value = null
  } finally {
    loading.value = false
  }
}

const onKeydown = (e) => {
  if (!props.visible) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emitClose()
  }
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      resetState()
      loadRecall()
      window.addEventListener('keydown', onKeydown)
      bodyOverflowBeforeOpen = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    } else {
      window.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = bodyOverflowBeforeOpen
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = bodyOverflowBeforeOpen
})
</script>

<style scoped>
.recall-modal {
  position: fixed;
  inset: 0;
  z-index: 220;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recall-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(251, 250, 249, 0.52);
  backdrop-filter: blur(18px) saturate(1.15);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
}

.recall-modal-close {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 1px 4px rgba(24, 24, 27, 0.08);
  color: var(--color-primary);
  cursor: pointer;
}

.recall-modal-close:hover {
  background: rgba(255, 255, 255, 0.92);
}

.recall-modal-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: min(720px, calc(100% - 48px));
  height: 100%;
  padding: 72px 24px 96px;
  box-sizing: border-box;
  pointer-events: auto;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.recall-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 100%;
  min-height: 100%;
}

.recall-stage.is-detail {
  justify-content: flex-start;
  gap: 20px;
  padding: 48px 0 32px;
}

.recall-quote-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px 24px;
  width: min(720px, 100%);
  transform-origin: center top;
  flex-shrink: 0;
}

.recall-quote-block.is-compact {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.recall-quote-cell {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.recall-source-cell {
  flex: 0 0 auto;
  max-width: min(240px, 38%);
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.recall-quote-block.is-compact .recall-source-cell {
  max-width: 100%;
}

.recall-quote {
  margin: 0;
  text-align: left;
  font-size: clamp(22px, 3.5vw, 26px); /* 这一行是大小 */
  font-weight: 500;
  line-height: 1.55;
  color: var(--color-primary);
}

.recall-quote.is-compact {
  font-size: clamp(17px, 2.9vw, 22px);
  line-height: 1.5;
}

.recall-source {
  margin: 0;
  text-align: right;
  font-family: 'Kaiti SC', 'STKaiti', 'FangSong', 'Songti SC', serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  color: var(--color-secondary-text);
  white-space: nowrap;
}

.recall-quote-mark {
  color: var(--color-primary);
  font-weight: 600;
}

.recall-quote-text {
  margin: 0 0.12em;
}

.recall-detail-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 20px;
  width: 100%;
  min-height: auto;
  flex: 0 0 auto;
}

.recall-content-root {
  width: min(640px, 100%);
  max-height: none;
  overflow: visible;
  text-align: left;
  margin: 0 auto;
}

.recall-content-root :deep(p),
.recall-content-root :deep(h1),
.recall-content-root :deep(h2),
.recall-content-root :deep(h3),
.recall-content-root :deep(h4),
.recall-content-root :deep(h5),
.recall-content-root :deep(h6),
.recall-content-root :deep(li),
.recall-content-root :deep(blockquote) {
  margin: 0 0 0.75em;
  color: var(--color-text);
  font-size: 15px;
  line-height: 1.75;
  word-break: break-word;
  text-align: left;
}

.recall-content-root :deep(ul),
.recall-content-root :deep(ol) {
  margin: 0 0 0.75em;
  padding-left: 1.25em;
  text-align: left;
}

.recall-content-root :deep(pre),
.recall-content-root :deep(.monaco-editor) {
  margin-left: auto;
  margin-right: auto;
  text-align: left;
}

.recall-content-root :deep(p:last-child) {
  margin-bottom: 0;
}

.recall-content-root :deep(.code-action-btn),
.recall-content-root :deep(.copy-button) {
  display: none !important;
}

.recall-content-root :deep(.monaco-editor),
.recall-content-root :deep(.monaco-editor-background),
.recall-content-root :deep(.monaco-editor .margin),
.recall-content-root :deep(.monaco-editor .lines-content),
.recall-content-root :deep(.monaco-editor .view-overlays),
.recall-content-root :deep(.monaco-editor .overflow-guard),
.recall-content-root :deep(.monaco-diff-editor),
.recall-content-root :deep(pre[class*='language-']),
.recall-content-root :deep(pre.shiki) {
  background: rgba(255, 255, 255, 0.85) !important;
}

.recall-content-root :deep(pre.shiki),
.recall-content-root :deep(pre[class*='language-']) {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
}

.recall-content-fallback {
  margin: 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
}

.recall-time {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 400;
  color: #a1a1aa;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
  text-align: left; /* 文字左对齐 */
  width: 100%; /* 占满整行，才能左对齐 */
  max-width: min(640px, 100%); /* 和正文同宽 */
}

.recall-image-gallery {
  width: min(640px, 100%);
  margin: 2px auto 0;
}

.recall-expand-btn {
  position: fixed;
  left: 50%;
  bottom: 64px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-left: -26px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--btn-primary-bg);
  box-shadow:
    0 8px 28px rgba(37, 99, 235, 0.12),
    0 2px 8px rgba(24, 24, 27, 0.06);
  color: var(--btn-primary-fg);
  cursor: pointer;
}

.recall-expand-btn:hover {
  background: var(--btn-primary-bg-hover);
}

.recall-status {
  margin: 0;
  font-size: 15px;
  color: var(--color-secondary-text);
}

.recall-status-error {
  color: var(--color-error);
}

@media (max-width: 720px) {
  .recall-modal-inner {
    width: calc(100% - 32px);
    padding-bottom: 88px;
  }

  .recall-quote {
    font-size: clamp(18px, 5.5vw, 28px);
  }

  .recall-source {
    white-space: normal;
  }

  .recall-expand-btn {
    bottom: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recall-modal-backdrop {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
