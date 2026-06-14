<template>
  <AnimatePresence>
    <motion.aside
      v-if="open"
      key="fragments-panel"
      class="struct-note-fragments"
      aria-label="已选碎片笔记"
      :initial="{ width: 0, opacity: 0, x: 16 }"
      :animate="{ width: FRAGMENTS_PANEL_WIDTH, opacity: 1, x: 0 }"
      :exit="{ width: 0, opacity: 0, x: 16 }"
      :transition="{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }"
    >
      <div class="struct-note-fragments-inner">
        <div class="struct-note-fragments-head">
          <h3 class="struct-note-fragments-title">
            {{ panelTitle }}
          </h3>
          <div class="struct-note-fragments-head-actions">
            <button
              v-if="mode === 'compose' && fragmentNotes.length"
              type="button"
              class="struct-note-fragments-insert-all"
              :disabled="disabled || allFragmentsInserted"
              @click="emit('insert-all')"
            >
              全部插入
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

        <p
          v-if="mode === 'compose' && fragmentNotes.length"
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

        <p v-if="!fragmentNotes.length" class="struct-note-fragments-empty">
          {{ emptyText }}
        </p>

        <ul v-else ref="listRef" class="struct-note-fragments-list">
          <AnimatePresence mode="popLayout">
            <motion.li
              v-for="note in fragmentNotes"
              :key="note.id"
              :ref="(el) => setItemRef(note.id, el)"
              class="struct-note-fragment-item"
              :class="{
                'is-active': activeFragmentId === String(note.id),
                'is-restoring': restoringConfirmId === String(note.id),
              }"
              layout
              :initial="itemMotion.initial"
              :animate="itemMotion.animate"
              :exit="itemMotion.exit"
              :transition="itemMotion.transition"
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
                  <p v-else class="struct-note-fragment-empty">（暂无内容）</p>
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
                  :class="{ 'is-added': insertedIds.has(note.id) }"
                  :disabled="disabled || insertedIds.has(note.id)"
                  :aria-label="insertedIds.has(note.id) ? '已加入正文' : '加入正文'"
                  :title="insertedIds.has(note.id) ? '已加入正文' : '加入正文'"
                  :while-hover="disabled || insertedIds.has(note.id) ? undefined : presets.button.hover"
                  :while-tap="disabled || insertedIds.has(note.id) ? undefined : presets.button.tap"
                  :transition="presets.button.transition"
                  @click="emit('insert', note)"
                >
                  <svg
                    v-if="insertedIds.has(note.id)"
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
                  v-if="mode === 'source'"
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
              </div>
            </motion.li>
          </AnimatePresence>
        </ul>
      </div>
    </motion.aside>
  </AnimatePresence>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { getFragmentContent, formatFragmentTime } from '../../composables/useStructNoteFragments'
import { useMotionPresets } from '../../composables/useMotionPresets'
import TiptapPreview from '../common/TiptapPreview.vue'

const props = defineProps({
  fragmentNotes: { type: Array, default: () => [] },
  insertedIds: { type: Object, default: () => new Set() },
  disabled: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  activeFragmentId: { type: String, default: '' },
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
})

const emit = defineEmits(['update:open', 'update:fragmentNotes', 'insert', 'insert-all', 'restore'])

const panelTitle = computed(() => {
  if (props.mode === 'source') {
    return `来源碎片（${props.fragmentNotes.length}）`
  }
  return `已选碎片（${props.fragmentNotes.length}）`
})

const emptyText = computed(() =>
  props.mode === 'source'
    ? '暂无关联的碎片'
    : '暂无碎片，点击上方 + 添加',
)

const FRAGMENTS_PANEL_WIDTH = 360

const { presets, reduced } = useMotionPresets()
const listRef = ref(null)
const itemRefs = ref(new Map())
const restoringConfirmId = ref('')

const itemMotion = computed(() => {
  if (reduced.value) {
    return { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
  }
  return {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    exit: presets.value.listItemExit,
    transition: { duration: 0.18, ease: 'easeOut' },
  }
})

const setItemRef = (id, el) => {
  const key = String(id)
  if (el) {
    itemRefs.value.set(key, el)
  } else {
    itemRefs.value.delete(key)
  }
}

const scrollToActiveFragment = async () => {
  if (!props.activeFragmentId) return
  await nextTick()
  const el = itemRefs.value.get(props.activeFragmentId)
  el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
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
  () => props.restoringId,
  (id) => {
    if (!id) restoringConfirmId.value = ''
  },
)

watch(
  () => props.open,
  (open) => {
    if (!open) restoringConfirmId.value = ''
  },
)

watch(
  () => [props.activeFragmentId, props.open],
  () => {
    if (props.open) scrollToActiveFragment()
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
  width: 360px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 0 0 20px;
  box-sizing: border-box;
}

.struct-note-fragments-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  padding-right: 4px;
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

.struct-note-fragments-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-secondary-text);
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

.struct-note-fragments-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0 4px 0 0;
  list-style: none;
}

.struct-note-fragment-item {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
}

.struct-note-fragment-item.is-active {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.04);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
}

.struct-note-fragment-item.is-restoring {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(37, 99, 235, 0.04);
}

.struct-note-fragment-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-bottom: 8px;
}

.struct-note-fragment-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.struct-note-fragment-time {
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.struct-note-fragment-main {
  flex: 1;
  min-width: 0;
}

.struct-note-fragment-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text);
  word-break: break-word;
}

.struct-note-fragment-content :deep(.tiptap-content .ProseMirror) {
  font-size: 13px;
  line-height: 1.6;
}

.struct-note-fragment-content :deep(.tiptap-content .ProseMirror > :last-child) {
  margin-bottom: 0;
}

.struct-note-fragment-empty {
  margin: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.struct-note-fragment-footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(24, 24, 27, 0.06);
}

.fragment-item-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
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

.fragment-item-action-btn--restore:hover:not(:disabled) {
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
  color: var(--color-accent);
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
  background: var(--color-accent);
  color: #fff;
}

.fragment-restore-btn--yes:hover:not(:disabled) {
  background: #1d4ed8;
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
