<template>
  <div class="struct-note-material-bar">
    <span class="struct-note-material-label">
      碎片 · {{ fragmentNotes.length }} 条
    </span>

    <div class="struct-note-material-chips" role="list">
      <button
        v-for="note in fragmentNotes"
        :key="note.id"
        type="button"
        class="struct-note-material-chip"
        :class="{
          'is-active': panelOpen && activeFragmentId === String(note.id),
          'is-inserted': insertedIds.has(note.id),
        }"
        role="listitem"
        :aria-pressed="panelOpen && activeFragmentId === String(note.id)"
        :disabled="disabled"
        @click="onChipClick(note)"
      >
        <span class="struct-note-material-chip-text">{{ getFragmentChipLabel(note) }}</span>
        <svg
          v-if="insertedIds.has(note.id)"
          class="struct-note-material-chip-check"
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </button>
    </div>

    <button
      type="button"
      class="struct-note-material-add-chip"
      :disabled="disabled"
      aria-label="添加碎片"
      title="添加碎片"
      @click="pickerVisible = true"
    >
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>

    <StructNoteFragmentPickerModal
      :visible="pickerVisible"
      :selected-notes="fragmentNotes"
      @close="pickerVisible = false"
      @confirm="onPickerConfirm"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getFragmentChipLabel } from '../../composables/useStructNoteFragments'
import StructNoteFragmentPickerModal from './StructNoteFragmentPickerModal.vue'

const props = defineProps({
  fragmentNotes: { type: Array, default: () => [] },
  insertedIds: { type: Object, default: () => new Set() },
  disabled: { type: Boolean, default: false },
  mode: {
    type: String,
    default: 'compose',
    validator: (value) => ['compose', 'source'].includes(value),
  },
  panelOpen: { type: Boolean, default: false },
  activeFragmentId: { type: String, default: '' },
})

const emit = defineEmits(['update:fragmentNotes', 'toggle-fragment'])

const pickerVisible = ref(false)

const onChipClick = (note) => {
  if (props.disabled || !note?.id) return
  emit('toggle-fragment', note)
}

const onPickerConfirm = (notes) => {
  emit('update:fragmentNotes', notes)
  pickerVisible.value = false
}
</script>

<style scoped>
.struct-note-material-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  margin-bottom: 14px;
  flex: 0 0 auto;
}

.struct-note-material-label {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
  white-space: nowrap;
}

.struct-note-material-chips {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 2px 0;
}

.struct-note-material-chips::-webkit-scrollbar {
  display: none;
}

.struct-note-material-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 180px;
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
  transition: border-color 0.14s ease, background-color 0.14s ease, opacity 0.14s ease;
}

.struct-note-material-chip:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.28);
  background: #fff;
}

.struct-note-material-chip.is-active {
  border-color: rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.06);
  box-shadow: var(--focus-ring);
}

.struct-note-material-chip.is-inserted {
  opacity: 0.62;
  border-color: rgba(24, 24, 27, 0.08);
  background: rgba(24, 24, 27, 0.03);
}

.struct-note-material-chip.is-inserted.is-active {
  opacity: 0.82;
}

.struct-note-material-chip:disabled {
  cursor: not-allowed;
}

.struct-note-material-chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.struct-note-material-chip-check {
  flex: 0 0 auto;
  color: var(--color-success);
}

.struct-note-material-add-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  box-shadow: var(--btn-primary-shadow);
  cursor: pointer;
}

.struct-note-material-add-chip:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
  box-shadow: var(--btn-primary-shadow-hover);
}

.struct-note-material-add-chip:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
  box-shadow: none;
}
</style>
