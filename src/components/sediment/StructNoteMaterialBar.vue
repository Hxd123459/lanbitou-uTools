<template>
  <div class="struct-note-material-bar">
    <span class="struct-note-material-label">
      碎片 · {{ fragmentNotes.length }} 条
    </span>

    <div class="struct-note-material-chips" role="list">
      <button
        v-for="(note, index) in fragmentNotes"
        :key="note.id"
        :ref="(el) => setChipRef(index, el)"
        type="button"
        class="struct-note-material-chip"
        :class="{
          'is-active': popoverIndex === index,
          'is-inserted': insertedIds.has(note.id),
        }"
        role="listitem"
        :aria-pressed="popoverIndex === index"
        :disabled="disabled"
        @click="openPopover(index)"
      >
        <span class="struct-note-material-chip-text">{{ getFragmentTitle(note) }}</span>
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

    <div class="struct-note-material-actions">
      <button
        v-if="mode === 'compose'"
        type="button"
        class="struct-note-material-action"
        :disabled="disabled"
        aria-label="添加碎片"
        @click="pickerVisible = true"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        添加
      </button>
      <button
        type="button"
        class="struct-note-material-action struct-note-material-action--expand"
        :disabled="disabled || !fragmentNotes.length"
        aria-label="展开碎片面板"
        @click="emit('expand')"
      >
        展开
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>

    <StructNoteFragmentPopover
      :visible="popoverIndex >= 0"
      :anchor-el="activeChipEl"
      :fragment-notes="fragmentNotes"
      :active-index="popoverIndex >= 0 ? popoverIndex : 0"
      :inserted-ids="insertedIds"
      :disabled="disabled"
      :mode="mode"
      :restoring-id="restoringId"
      @close="closePopover"
      @insert="onInsert"
      @remove="onRemove"
      @restore="emit('restore', $event)"
      @navigate="onNavigate"
    />

    <StructNoteFragmentPickerModal
      v-if="mode === 'compose'"
      :visible="pickerVisible"
      :selected-notes="fragmentNotes"
      @close="pickerVisible = false"
      @confirm="onPickerConfirm"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getFragmentTitle } from '../../composables/useStructNoteFragments'
import StructNoteFragmentPickerModal from './StructNoteFragmentPickerModal.vue'
import StructNoteFragmentPopover from './StructNoteFragmentPopover.vue'

const props = defineProps({
  fragmentNotes: { type: Array, default: () => [] },
  insertedIds: { type: Object, default: () => new Set() },
  disabled: { type: Boolean, default: false },
  mode: {
    type: String,
    default: 'compose',
    validator: (value) => ['compose', 'source'].includes(value),
  },
  restoringId: { type: String, default: '' },
})

const emit = defineEmits([
  'update:fragmentNotes',
  'insert',
  'restore',
  'expand',
])

const popoverIndex = ref(-1)
const pickerVisible = ref(false)
const chipRefs = ref([])

const activeChipEl = computed(() => {
  if (popoverIndex.value < 0) return null
  return chipRefs.value[popoverIndex.value] ?? null
})

const setChipRef = (index, el) => {
  chipRefs.value[index] = el
}

const openPopover = (index) => {
  popoverIndex.value = index
}

const closePopover = () => {
  popoverIndex.value = -1
}

const onNavigate = (delta) => {
  const next = popoverIndex.value + delta
  if (next >= 0 && next < props.fragmentNotes.length) {
    popoverIndex.value = next
  }
}

const onInsert = (note) => {
  emit('insert', note)
}

const onRemove = (note) => {
  emit(
    'update:fragmentNotes',
    props.fragmentNotes.filter((item) => item.id !== note.id),
  )
  if (popoverIndex.value >= props.fragmentNotes.length - 1) {
    popoverIndex.value = Math.max(0, props.fragmentNotes.length - 2)
  }
  if (props.fragmentNotes.length <= 1) {
    closePopover()
  }
}

const onPickerConfirm = (notes) => {
  emit('update:fragmentNotes', notes)
  pickerVisible.value = false
}

watch(
  () => props.fragmentNotes.length,
  (length) => {
    if (popoverIndex.value >= length) {
      popoverIndex.value = length > 0 ? length - 1 : -1
    }
  },
)
</script>

<style scoped>
.struct-note-material-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  margin-bottom: 14px;
  flex: 0 0 auto;
}

.struct-note-material-label {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
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
  max-width: 140px;
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

.struct-note-material-actions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.struct-note-material-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.struct-note-material-action:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
}

.struct-note-material-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.struct-note-material-action--expand {
  padding-right: 4px;
}
</style>
