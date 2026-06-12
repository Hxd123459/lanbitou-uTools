<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="panelRef"
      class="fragment-popover"
      :style="panelStyle"
      role="dialog"
      :aria-label="`${getFragmentTitle(activeNote)} 预览`"
      @mousedown.prevent
    >
      <header class="fragment-popover-head">
        <button
          type="button"
          class="fragment-popover-nav"
          :disabled="!canGoPrev"
          aria-label="上一个碎片"
          @click="emit('navigate', -1)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>

        <div class="fragment-popover-title-wrap">
          <p class="fragment-popover-title">{{ getFragmentTitle(activeNote) }}</p>
          <p v-if="fragmentNotes.length > 1" class="fragment-popover-index">
            {{ activeIndex + 1 }} / {{ fragmentNotes.length }}
          </p>
        </div>

        <button
          type="button"
          class="fragment-popover-nav"
          :disabled="!canGoNext"
          aria-label="下一个碎片"
          @click="emit('navigate', 1)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </header>

      <div class="fragment-popover-body">
        <p v-if="!previewText" class="fragment-popover-empty">（暂无内容）</p>
        <p v-else class="fragment-popover-preview">{{ previewText }}</p>
      </div>

      <footer class="fragment-popover-foot">
        <button
          v-if="mode === 'compose'"
          type="button"
          class="fragment-popover-btn fragment-popover-btn--primary"
          :disabled="disabled || isInserted || !activeNote"
          @click="emit('insert', activeNote)"
        >
          <svg
            v-if="isInserted"
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
          {{ isInserted ? '已插入' : '插入正文' }}
        </button>
        <button
          type="button"
          class="fragment-popover-btn fragment-popover-btn--ghost"
          :disabled="disabled || !activeNote || (mode === 'source' && restoringId === activeNote?.id)"
          @click="onRemove"
        >
          {{ mode === 'source' ? (restoringId === activeNote?.id ? '…' : '还原') : '移除' }}
        </button>
      </footer>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  getFragmentContent,
  getFragmentTitle,
} from '../../composables/useStructNoteFragments'

const props = defineProps({
  visible: { type: Boolean, default: false },
  anchorEl: { type: Object, default: null },
  fragmentNotes: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: 0 },
  insertedIds: { type: Object, default: () => new Set() },
  disabled: { type: Boolean, default: false },
  mode: {
    type: String,
    default: 'compose',
    validator: (value) => ['compose', 'source'].includes(value),
  },
  restoringId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'insert', 'remove', 'restore', 'navigate'])

const panelRef = ref(null)
const panelStyle = ref({ left: '0px', top: '0px' })

const activeNote = computed(() => props.fragmentNotes[props.activeIndex] ?? null)

const canGoPrev = computed(() => props.activeIndex > 0)
const canGoNext = computed(() => props.activeIndex < props.fragmentNotes.length - 1)

const isInserted = computed(() => {
  const id = activeNote.value?.id
  return id != null && props.insertedIds.has(id)
})

const previewText = computed(() => {
  const raw = getFragmentContent(activeNote.value).trim()
  return raw.replace(/\s+/g, ' ')
})

const resolveAnchorEl = () => {
  const anchor = props.anchorEl
  if (!anchor) return null
  const raw = anchor instanceof HTMLElement ? anchor : anchor.value
  if (raw instanceof HTMLElement) return raw
  if (raw?.$el instanceof HTMLElement) return raw.$el
  return null
}

const updatePosition = async () => {
  await nextTick()
  const anchor = resolveAnchorEl()
  const panel = panelRef.value
  if (!anchor || !panel) return

  const rect = anchor.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const padding = 8
  const gap = 8
  const anchorCenterX = rect.left + rect.width / 2
  let left = anchorCenterX - panelRect.width / 2
  let top = rect.bottom + gap

  if (left < padding) {
    left = padding
  } else if (left + panelRect.width > window.innerWidth - padding) {
    left = Math.max(padding, window.innerWidth - panelRect.width - padding)
  }

  if (top + panelRect.height > window.innerHeight - padding) {
    top = Math.max(padding, rect.top - panelRect.height - gap)
  }

  panelStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  }
}

const onRemove = () => {
  if (!activeNote.value) return
  if (props.mode === 'source') {
    emit('restore', activeNote.value)
    return
  }
  emit('remove', activeNote.value)
}

const onDocumentPointerDown = (event) => {
  if (!props.visible) return
  const panel = panelRef.value
  const anchor = resolveAnchorEl()
  if (panel?.contains(event.target) || anchor?.contains(event.target)) return
  emit('close')
}

const onKeydown = (event) => {
  if (!props.visible) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (canGoPrev.value) emit('navigate', -1)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    if (canGoNext.value) emit('navigate', 1)
  }
}

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      await updatePosition()
      document.addEventListener('pointerdown', onDocumentPointerDown)
      window.addEventListener('resize', updatePosition)
      window.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

watch(
  () => [props.activeIndex, props.anchorEl],
  () => {
    if (props.visible) void updatePosition()
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.fragment-popover {
  position: fixed;
  z-index: 225;
  width: min(340px, calc(100vw - 16px));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-float, 0 16px 40px rgba(24, 24, 27, 0.12));
  overflow: hidden;
}

.fragment-popover-head {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 4px;
  padding: 10px 8px 8px;
  border-bottom: 1px solid rgba(24, 24, 27, 0.06);
}

.fragment-popover-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.fragment-popover-nav:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
}

.fragment-popover-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.fragment-popover-title-wrap {
  min-width: 0;
  text-align: center;
}

.fragment-popover-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fragment-popover-index {
  margin: 2px 0 0;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
}

.fragment-popover-body {
  max-height: min(240px, 40vh);
  overflow-y: auto;
  padding: 12px 14px;
}

.fragment-popover-preview,
.fragment-popover-empty {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.fragment-popover-empty {
  color: var(--color-secondary-text);
}

.fragment-popover-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(24, 24, 27, 0.06);
}

.fragment-popover-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--btn-radius);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.fragment-popover-btn--primary {
  border: 0;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  box-shadow: var(--btn-primary-shadow);
}

.fragment-popover-btn--primary:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
}

.fragment-popover-btn--primary:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
  box-shadow: none;
}

.fragment-popover-btn--ghost {
  flex: 0 0 auto;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-secondary-text);
}

.fragment-popover-btn--ghost:hover:not(:disabled) {
  border-color: rgba(24, 24, 27, 0.18);
  color: var(--color-primary);
}

.fragment-popover-btn--ghost:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}
</style>
