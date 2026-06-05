<template>
  <div
    class="struct-note-editor-layout"
    :class="{ 'is-fragments-open': fragmentsOpen }"
  >
    <div class="struct-note-editor-zone">
      <div class="struct-note-editor-column">
        <slot />
      </div>
    </div>

    <StructNoteFragmentsPanel
      v-model:open="fragmentsOpen"
      :fragment-notes="fragmentNotes"
      :inserted-ids="insertedIds"
      :disabled="disabled"
      :show-expand-button="showExpandButton"
      @update:fragment-notes="emit('update:fragmentNotes', $event)"
      @insert="emit('insert', $event)"
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
  open: { type: Boolean, default: true },
  showExpandButton: { type: Boolean, default: true },
})

const emit = defineEmits(['update:fragmentNotes', 'update:open', 'insert'])

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
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  justify-content: center;
  overflow: hidden;
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

@media (max-width: 900px) {
  .struct-note-editor-layout {
    flex-direction: column;
  }
}
</style>
