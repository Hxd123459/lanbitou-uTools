<template>
  <li
    class="todo-item-row"
    :class="{
      'is-done': todo.done,
      'is-editing': editing,
      'is-selected': selected,
      'is-expanded': expanded,
    }"
  >
    <label v-if="selectable" class="todo-item-select">
      <input
        type="checkbox"
        :checked="selected"
        :disabled="busy || editing || todo.done"
        @change="emit('select-change', { todo, selected: $event.target.checked })"
      />
    </label>

    <button
      type="button"
      class="todo-item-check"
      :class="{ 'is-checked': todo.done }"
      :aria-pressed="todo.done"
      :aria-label="todo.done ? '标记为未完成' : '标记为已完成'"
      :disabled="editing || todo.runStatus === 'running' || todo.runStatus === 'queued'"
      @click="emit('toggle', todo)"
    >
      <svg
        v-if="todo.done"
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
        maxlength="120"
        :disabled="busy"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @blur="commitEdit"
      />
      <p v-else class="todo-item-title" @dblclick="startEdit">{{ todo.title }}</p>

      <div class="todo-item-meta">
        <span
          v-if="runStatusLabel"
          class="todo-run-badge"
          :class="`is-${todo.runStatus}`"
        >
          {{ runStatusLabel }}
        </span>
        <button
          v-if="todo.sourceTagId && todo.sourceTagName"
          type="button"
          class="note-tag"
          :title="`查看标签「${todo.sourceTagName}」下的碎片`"
          :disabled="busy || editing"
          @click="emit('open-tag', { id: todo.sourceTagId, name: todo.sourceTagName })"
        >
          #{{ todo.sourceTagName }}
        </button>
        <span
          v-else-if="todo.sourceTagName"
          class="note-tag is-static"
          :title="`来源标签「${todo.sourceTagName}」`"
        >
          #{{ todo.sourceTagName }}
        </span>
        <span
          v-if="todo.sourceNoteTitle"
          class="todo-item-source-title"
          :title="`来自标题「${todo.sourceNoteTitle}」`"
        >
          {{ todo.sourceNoteTitle }}
        </span>
        <button
          v-if="todo.sourceNoteId"
          type="button"
          class="todo-item-source"
          :disabled="busy || editing"
          @click="emit('open-source', todo)"
        >
          查看来源
        </button>
        <span v-if="todo.sourceExcerpt" class="todo-item-excerpt" :title="todo.sourceExcerpt">
          {{ todo.sourceExcerpt }}
        </span>
      </div>

      <div v-if="expanded && runDetail" class="todo-run-detail">
        <p v-if="runDetail.summary" class="todo-run-summary">{{ runDetail.summary }}</p>
        <p v-else-if="runDetail.error" class="todo-run-error">{{ runDetail.error }}</p>
        <p v-else class="todo-run-summary is-muted">暂无摘要</p>
        <p v-if="runDetail.changedFiles?.length" class="todo-run-files">
          改动文件：{{ runDetail.changedFiles.join('、') }}
        </p>
        <pre v-if="runDetail.log" class="todo-run-log">{{ runDetail.log.slice(-2500) }}</pre>
      </div>

      <div
        v-if="todo.runStatus === 'pending_review' || todo.runStatus === 'failed'"
        class="todo-review-actions"
      >
        <template v-if="todo.runStatus === 'pending_review'">
          <button type="button" class="todo-review-btn is-primary" :disabled="busy" @click="emit('accept', todo)">
            通过
          </button>
          <button type="button" class="todo-review-btn" :disabled="busy" @click="emit('reject', todo)">
            打回重跑
          </button>
        </template>
        <template v-else>
          <button type="button" class="todo-review-btn" :disabled="busy" @click="emit('retry', todo)">
            重试
          </button>
          <button type="button" class="todo-review-btn" :disabled="busy" @click="emit('dismiss-failed', todo)">
            忽略
          </button>
        </template>
        <button
          v-if="todo.lastRunId"
          type="button"
          class="todo-review-btn"
          :disabled="busy"
          @click="toggleExpand"
        >
          {{ expanded ? '收起' : '查看结果' }}
        </button>
      </div>
    </div>

    <div class="todo-item-actions">
      <motion.button
        v-if="!editing"
        type="button"
        class="icon-btn"
        title="编辑待办"
        aria-label="编辑待办"
        :disabled="busy"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="startEdit"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </motion.button>
      <motion.button
        type="button"
        class="icon-btn icon-btn-danger"
        title="删除待办"
        aria-label="删除待办"
        :disabled="busy || editing"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="emit('delete', todo)"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </motion.button>
    </div>
  </li>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { TODO_RUN_STATUS_LABEL } from '../../constants/todoRunStatus'

const props = defineProps({
  todo: {
    type: Object,
    required: true,
  },
  busy: {
    type: Boolean,
    default: false,
  },
  selectable: {
    type: Boolean,
    default: false,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  runDetail: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'toggle',
  'delete',
  'open-source',
  'open-tag',
  'update-title',
  'select-change',
  'accept',
  'reject',
  'retry',
  'dismiss-failed',
  'load-run',
])
const { presets } = useMotionPresets()

const editing = ref(false)
const editTitle = ref('')
const editInputRef = ref(null)
const expanded = ref(false)
let committing = false

const runStatusLabel = computed(
  () => TODO_RUN_STATUS_LABEL[props.todo?.runStatus] || '',
)

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

const toggleExpand = () => {
  expanded.value = !expanded.value
  if (expanded.value) emit('load-run', props.todo)
}
</script>

<style scoped>
.todo-item-row {
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
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.04);
}

.todo-item-select {
  flex: 0 0 auto;
  margin-top: 4px;
  display: inline-flex;
}

.todo-item-check {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid rgba(24, 24, 27, 0.28);
  border-radius: 6px;
  background: transparent;
  color: transparent;
  cursor: pointer;
  padding: 0;
}

.todo-item-check.is-checked {
  background: rgba(24, 24, 27, 0.92);
  border-color: rgba(24, 24, 27, 0.92);
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

.todo-run-badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
}

.todo-run-badge.is-queued,
.todo-run-badge.is-running {
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-accent);
}

.todo-run-badge.is-pending_review {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.todo-run-badge.is-failed {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.note-tag {
  display: inline-block;
  padding: 2px 8px;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.2px;
  white-space: nowrap;
  cursor: pointer;
}

button.note-tag:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-accent);
}

.note-tag.is-static {
  cursor: default;
}

.todo-item-source-title {
  font-size: 12px;
  color: var(--color-secondary-text);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-item-source {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.todo-item-source:hover {
  text-decoration: underline;
}

.todo-item-excerpt {
  font-size: 12px;
  color: var(--color-secondary-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.todo-run-detail {
  margin-top: 8px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.03);
  border: 1px solid var(--color-border);
}

.todo-run-summary,
.todo-run-error,
.todo-run-files {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.todo-run-summary.is-muted {
  color: rgba(24, 24, 27, 0.4);
}

.todo-run-error {
  color: var(--color-error);
}

.todo-run-log {
  margin: 0;
  max-height: 160px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.45;
  color: var(--color-secondary-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.todo-review-actions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.todo-review-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-bg);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.todo-review-btn.is-primary {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-accent);
}

.todo-review-btn:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.todo-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-secondary-text);
  cursor: pointer;
  padding: 0;
}

.icon-btn:hover:not(:disabled) {
  border-color: var(--btn-icon-border-hover);
  background: var(--btn-icon-bg-hover);
  color: var(--btn-icon-color-hover);
}

.icon-btn-danger:hover:not(:disabled) {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.06);
  color: var(--color-error);
}

.todo-item-check:disabled,
.todo-item-source:disabled,
.icon-btn:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}
</style>
