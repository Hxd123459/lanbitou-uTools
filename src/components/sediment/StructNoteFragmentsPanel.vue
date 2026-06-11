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
            <motion.button
              v-if="mode === 'compose'"
              type="button"
              class="struct-note-fragments-action"
              aria-label="添加碎片"
              :disabled="disabled"
              :while-hover="disabled ? undefined : presets.button.hover"
              :while-tap="disabled ? undefined : presets.button.tap"
              :transition="presets.button.transition"
              @click="pickerVisible = true"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </motion.button>
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

        <p v-if="!fragmentNotes.length" class="struct-note-fragments-empty">
          {{ emptyText }}
        </p>

        <ul v-else class="struct-note-fragments-list">
          <AnimatePresence mode="popLayout">
            <motion.li
              v-for="note in fragmentNotes"
              :key="note.id"
              class="struct-note-fragment-item"
              layout
              :initial="itemMotion.initial"
              :animate="itemMotion.animate"
              :exit="itemMotion.exit"
              :transition="itemMotion.transition"
            >
              <motion.button
                v-if="mode === 'source'"
                type="button"
                class="struct-note-fragment-restore"
                :disabled="disabled || restoringId === note.id"
                aria-label="放回碎片列表"
                :while-hover="disabled || restoringId === note.id ? undefined : presets.button.hover"
                :while-tap="disabled || restoringId === note.id ? undefined : presets.button.tap"
                :transition="presets.button.transition"
                @click="emit('restore', note)"
              >
                {{ restoringId === note.id ? '…' : '还原' }}
              </motion.button>
              <motion.button
                v-else
                type="button"
                class="struct-note-fragment-add"
                :class="{ 'is-added': insertedIds.has(note.id) }"
                :disabled="disabled || insertedIds.has(note.id)"
                :aria-label="insertedIds.has(note.id) ? '已加入' : '加入笔记'"
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
                  stroke-width="2.2"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </motion.button>
              <div class="struct-note-fragment-main">
                <p class="struct-note-fragment-title">{{ getFragmentTitle(note) }}</p>
                <p class="struct-note-fragment-preview">{{ getFragmentPreview(note) }}</p>
              </div>
            </motion.li>
          </AnimatePresence>
        </ul>
      </div>
    </motion.aside>
  </AnimatePresence>

  <StructNoteFragmentPickerModal
    v-if="mode === 'compose'"
    :visible="pickerVisible"
    :selected-notes="fragmentNotes"
    @close="pickerVisible = false"
    @confirm="onPickerConfirm"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import {
  getFragmentPreview,
  getFragmentTitle,
} from '../../composables/useStructNoteFragments'
import { useMotionPresets } from '../../composables/useMotionPresets'
import StructNoteFragmentPickerModal from './StructNoteFragmentPickerModal.vue'

const props = defineProps({
  fragmentNotes: { type: Array, default: () => [] },
  insertedIds: { type: Object, default: () => new Set() },
  disabled: { type: Boolean, default: false },
  open: { type: Boolean, default: true },
  mode: {
    type: String,
    default: 'compose',
    validator: (value) => ['compose', 'source'].includes(value),
  },
  restoringId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:open', 'update:fragmentNotes', 'insert', 'restore'])

const panelTitle = computed(() => {
  if (props.mode === 'source') {
    return `来源碎片（${props.fragmentNotes.length}）`
  }
  return `已选碎片（${props.fragmentNotes.length}）`
})

const emptyText = computed(() =>
  props.mode === 'source'
    ? '暂无关联的碎片'
    : '暂无碎片，点击 + 添加',
)

const FRAGMENTS_PANEL_WIDTH = 360

const { presets, reduced } = useMotionPresets()
const pickerVisible = ref(false)

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

const onPickerConfirm = (notes) => {
  emit('update:fragmentNotes', notes)
  pickerVisible.value = false
  if (!props.open) emit('update:open', true)
}
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
}

.struct-note-fragments-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-secondary-text);
}

.struct-note-fragments-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
}

.struct-note-fragment-main {
  flex: 1;
  min-width: 0;
}

.struct-note-fragment-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.struct-note-fragment-preview {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.struct-note-fragment-add {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--btn-radius);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  box-shadow: var(--btn-primary-shadow);
  cursor: pointer;
}

.struct-note-fragment-add:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
  box-shadow: var(--btn-primary-shadow-hover);
}

.struct-note-fragment-add:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
  box-shadow: none;
}

.struct-note-fragment-add.is-added {
  background: var(--btn-icon-bg-hover);
  color: var(--color-secondary-text);
}

.struct-note-fragment-restore {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--btn-radius);
  background: var(--color-surface);
  color: var(--color-secondary-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.struct-note-fragment-restore:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.struct-note-fragment-restore:disabled {
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
