<template>
  <div
    class="struct-note-editor-layout"
    :class="{ 'is-fragments-open': fragmentsOpen }"
  >
    <div class="struct-note-editor-zone">
      <div class="struct-note-editor-column">
        <slot />
      </div>

      <button
        v-if="showExpandButton && !fragmentsOpen"
        type="button"
        class="struct-note-fragments-expand"
        aria-label="展开碎片面板"
        @click="fragmentsOpen = true"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        <span>{{ fragmentsPanelLabel }}</span>
      </button>
    </div>

    <StructNoteFragmentsPanel
      v-model:open="fragmentsOpen"
      :fragment-notes="fragmentNotes"
      :inserted-ids="insertedIds"
      :disabled="disabled"
      :mode="fragmentsMode"
      :restoring-id="restoringId"
      :active-fragment-id="activeFragmentId"
      @update:fragment-notes="emit('update:fragmentNotes', $event)"
      @insert="emit('insert', $event)"
      @restore="emit('restore', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import StructNoteFragmentsPanel from './StructNoteFragmentsPanel.vue'

const props = defineProps({
  fragmentNotes: { type: Array, default: () => [] },
  insertedIds: { type: Object, default: () => new Set() },
  disabled: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  showExpandButton: { type: Boolean, default: true },
  fragmentsMode: {
    type: String,
    default: 'compose',
  },
  restoringId: {
    type: String,
    default: '',
  },
  activeFragmentId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:fragmentNotes', 'update:open', 'insert', 'restore'])

const fragmentsPanelLabel = computed(() =>
  props.fragmentsMode === 'source'
    ? `来源 ${props.fragmentNotes.length}`
    : `碎片 ${props.fragmentNotes.length}`,
)

const fragmentsOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})
</script>

<style scoped>
.struct-note-editor-layout {
  --struct-note-content-width: min(760px, 100%);
  --struct-note-fragments-width: 360px;
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 16px 18px 32px;
  box-sizing: border-box;
}

.struct-note-editor-zone {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  justify-content: center;
  overflow: visible;
}

.struct-note-editor-column {
  width: var(--struct-note-content-width);
  max-width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 0 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.struct-note-fragments-expand {
  position: absolute;
  top: 50%;
  right: -18px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px 10px 14px;
  border: 0;
  border-right: 0;
  border-radius: 8px 0 0 8px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transform: translateY(-50%);
  box-shadow: -1px 0 0 rgba(24, 24, 27, 0.06);
  transition: background-color 0.18s ease, color 0.18s ease;
}

.struct-note-fragments-expand:hover {
  background: rgba(24, 24, 27, 0.1);
  color: var(--color-primary);
}

@media (max-width: 900px) {
  .struct-note-editor-layout {
    flex-direction: column;
  }

  .struct-note-fragments-expand {
    top: auto;
    bottom: 0;
    right: 0;
    transform: none;
    border-radius: 8px;
  }
}
</style>
