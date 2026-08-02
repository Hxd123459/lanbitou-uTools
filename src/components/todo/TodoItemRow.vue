<template>
  <li
    class="todo-item-row"
    :data-todo-id="todo.id"
    :class="{
      'is-done': todo.done,
      'is-editing': editing,
      'is-selected': selected,
      'is-highlighted': highlighted,
    }"
  >
    <button
      v-if="sortable"
      type="button"
      class="todo-sort-handle"
      title="拖拽排序"
      aria-label="拖拽排序"
      :disabled="busy || editing"
      @click.stop
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="7" r="1.4" />
        <circle cx="15" cy="7" r="1.4" />
        <circle cx="9" cy="12" r="1.4" />
        <circle cx="15" cy="12" r="1.4" />
        <circle cx="9" cy="17" r="1.4" />
        <circle cx="15" cy="17" r="1.4" />
      </svg>
    </button>
    <button
      type="button"
      class="todo-item-check"
      :class="{ 'is-checked': selected }"
      :aria-pressed="selected"
      aria-label="选中待办"
      :disabled="busy || editing"
      @click="emit('select-change', { todo, selected: !selected })"
    >
      <svg
        v-if="selected"
        class="todo-item-check-icon"
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    </button>

    <div class="todo-item-main">
      <input
        v-if="editing"
        ref="editInputRef"
        v-model="editTitle"
        class="todo-item-edit-input"
        type="text"
        maxlength="240"
        :disabled="busy"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @blur="commitEdit"
      />
      <div v-else class="todo-item-title-row">
        <p class="todo-item-title" @dblclick="startEdit">{{ todo.title }}</p>
        <span
          class="todo-status-text"
          :class="todo.done ? 'is-done' : 'is-idle'"
        >
          {{ todo.done ? '已完成' : '未完成' }}
        </span>
      </div>

      <div v-if="todo.doneWhen || todo.sourceExcerpt" class="todo-item-meta">
        <span v-if="todo.doneWhen" class="todo-item-excerpt" :title="todo.doneWhen">
          验收：{{ todo.doneWhen }}
        </span>
        <span v-if="todo.sourceExcerpt" class="todo-item-excerpt" :title="todo.sourceExcerpt">
          {{ todo.sourceExcerpt }}
        </span>
      </div>

      <div v-if="!editing" class="todo-item-actions">
        <button
          type="button"
          class="todo-action-btn"
          :class="{ 'is-primary': !todo.done }"
          :disabled="busy"
          @click="emit('toggle-done', todo)"
        >
          <svg
            v-if="!todo.done"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9" />
            <path d="M3 4v5h5" />
          </svg>
          <span>{{ todo.done ? '取消完成' : '完成' }}</span>
        </button>

        <button
          v-if="todo.sourceNoteId"
          type="button"
          class="todo-action-btn"
          :disabled="busy"
          @click="emit('open-source', todo)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 6" />
            <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L14 18" />
          </svg>
          <span>查看来源</span>
        </button>
      </div>
    </div>

    <div v-if="!editing" class="todo-item-corner-actions">
      <button
        type="button"
        class="icon-btn"
        title="编辑"
        aria-label="编辑待办"
        :disabled="busy"
        @click="startEdit"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-btn icon-btn-danger"
        title="删除"
        aria-label="删除待办"
        :disabled="busy"
        @click="emit('delete', todo)"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </div>
  </li>
</template>

<script setup>
import { nextTick, ref } from 'vue'

const props = defineProps({
  todo: {
    type: Object,
    required: true,
  },
  busy: {
    type: Boolean,
    default: false,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  highlighted: {
    type: Boolean,
    default: false,
  },
  sortable: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'delete',
  'open-source',
  'update-title',
  'select-change',
  'toggle-done',
])

const editing = ref(false)
const editTitle = ref('')
const editInputRef = ref(null)
let committing = false

const startEdit = async () => {
  if (props.busy) return
  editing.value = true
  editTitle.value = props.todo.title || ''
  await nextTick()
  editInputRef.value?.focus?.()
  editInputRef.value?.select?.()
}

const cancelEdit = () => {
  editing.value = false
  editTitle.value = props.todo.title || ''
}

const commitEdit = () => {
  if (!editing.value || committing) return
  const next = String(editTitle.value || '').trim()
  if (!next || next === props.todo.title) {
    cancelEdit()
    return
  }
  committing = true
  editing.value = false
  emit('update-title', { todo: props.todo, title: next })
  nextTick(() => {
    committing = false
  })
}
</script>

<style scoped>
.todo-item-row {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.todo-item-row.is-done {
  opacity: 0.72;
}

.todo-item-row.is-selected {
  background: rgba(24, 24, 27, 0.04);
  border-color: rgba(24, 24, 27, 0.22);
}

.todo-item-row.is-highlighted {
  border-color: rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.08);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.todo-sort-handle {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #a1a1aa;
  cursor: grab;
}

.todo-sort-handle:hover:not(:disabled) {
  color: var(--color-secondary-text);
  background: rgba(24, 24, 27, 0.06);
}

.todo-sort-handle:active:not(:disabled) {
  cursor: grabbing;
}

.todo-sort-handle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.todo-item-check {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: #ffffff;
  cursor: pointer;
  padding: 0;
  box-sizing: border-box;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.todo-item-check.is-checked {
  border-color: #18181b;
  background: #18181b;
  color: #ffffff;
}

.todo-item-check-icon {
  display: block;
}

.todo-item-check:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.todo-item-main {
  flex: 1 1 auto;
  min-width: 0;
}

.todo-item-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-right: 4px;
}

.todo-item-title {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--color-text);
  word-break: break-word;
  cursor: text;
}

.todo-item-row.is-done .todo-item-title {
  text-decoration: line-through;
  color: var(--color-secondary-text);
}

.todo-status-text {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  background: rgba(100, 116, 139, 0.12);
  color: #64748b;
}

.todo-status-text.is-done {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.todo-status-text.is-idle {
  background: rgba(100, 116, 139, 0.12);
  color: #64748b;
}

.todo-item-edit-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.45;
}

.todo-item-edit-input:focus {
  outline: none;
  border-color: rgba(24, 24, 27, 0.45);
  box-shadow: 0 0 0 3px rgba(24, 24, 27, 0.08);
}

.todo-item-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.todo-item-excerpt {
  font-size: 12px;
  color: var(--color-secondary-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.todo-item-actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.todo-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-bg);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.todo-action-btn.is-primary {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-accent);
}

.todo-action-btn:hover:not(:disabled) {
  border-color: var(--btn-icon-border-hover);
  background: var(--btn-icon-bg-hover);
  color: var(--btn-icon-color-hover);
}

.todo-action-btn:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.todo-item-corner-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  margin-top: -2px;
  opacity: 0;
  transform: translateY(-1px);
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.todo-item-row:hover .todo-item-corner-actions,
.todo-item-row:focus-within .todo-item-corner-actions,
.todo-item-row.is-editing .todo-item-corner-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-text);
}

.icon-btn-danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
  color: var(--color-error);
}

.icon-btn:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}
</style>
