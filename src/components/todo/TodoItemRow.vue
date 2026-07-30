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
        <motion.span
          class="todo-status-text"
          :class="`is-${statusKey}`"
          :animate="todo.runStatus === 'running' ? runningPulse : undefined"
          :transition="todo.runStatus === 'running' ? runningTransition : undefined"
        >
          <span v-if="todo.runStatus === 'running'" class="todo-run-dot" aria-hidden="true" />
          {{ statusText }}
        </motion.span>
      </div>

      <div v-if="metricsVisible" class="todo-item-metrics" aria-label="执行指标">
        <span v-if="tokenLabel" class="todo-metric" title="Token 消耗">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
          <strong>{{ tokenLabel }}</strong>
          <span class="todo-metric-unit">tokens</span>
        </span>
        <span v-if="durationLabel" class="todo-metric" title="执行耗时">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <strong>{{ durationLabel }}</strong>
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

      <div v-if="expanded && runDetail" class="todo-run-detail">
        <TodoRunReviewPanel
          :todo="todo"
          :run-detail="runDetail"
          :busy="busy"
          :show-accept-note="todo.runStatus === 'pending_review'"
          :load-diff="loadDiff"
          @checklist-change="onChecklistChange"
          @review-note-change="onReviewNoteChange"
        />
      </div>

      <div v-if="continueOpen" class="todo-continue-box">
        <textarea
          ref="continueInputRef"
          v-model="continueFeedback"
          class="todo-continue-input"
          rows="2"
          maxlength="800"
          placeholder="哪里不满意？例如：样式再紧凑一点…"
          :disabled="busy"
          @keydown.enter.exact.prevent="submitContinue"
        />
        <div class="todo-continue-actions">
          <button type="button" class="todo-action-btn is-primary" :disabled="busy" @click="submitContinue">
            提交修改
          </button>
          <button type="button" class="todo-action-btn" :disabled="busy" @click="closeContinue">
            取消
          </button>
        </div>
      </div>

      <div v-if="!editing" class="todo-item-actions">
        <button
          v-if="canRun"
          type="button"
          class="todo-action-btn"
          :disabled="busy"
          @click="emit('run', todo)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
          <span>执行</span>
        </button>

        <template v-if="todo.runStatus === 'pending_review'">
          <button type="button" class="todo-action-btn is-primary" :disabled="busy" @click="emitAccept">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 4 4L19 6" />
            </svg>
            <span>通过</span>
          </button>
          <button type="button" class="todo-action-btn" :disabled="busy" @click="openContinue">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.6-6.3" />
              <path d="M21 3v6h-6" />
            </svg>
            <span>继续改</span>
          </button>
        </template>

        <template v-else-if="todo.runStatus === 'failed'">
          <button type="button" class="todo-action-btn" :disabled="busy" @click="emit('retry', todo)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.6-6.3" />
              <path d="M21 3v6h-6" />
            </svg>
            <span>重试</span>
          </button>
          <button type="button" class="todo-action-btn" :disabled="busy" @click="emit('dismiss-failed', todo)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            <span>忽略</span>
          </button>
        </template>

        <button
          v-else-if="canContinueAccepted"
          type="button"
          class="todo-action-btn"
          :disabled="busy"
          @click="openContinue"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.6-6.3" />
            <path d="M21 3v6h-6" />
          </svg>
          <span>继续改</span>
        </button>

        <button
          v-if="todo.lastRunId"
          type="button"
          class="todo-action-btn"
          :disabled="busy"
          @click="toggleExpand"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{{ expanded ? '收起' : '查看结果' }}</span>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { motion } from 'motion-v'
import TodoRunReviewPanel from './TodoRunReviewPanel.vue'

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
  canRunAgents: {
    type: Boolean,
    default: false,
  },
  runDetail: {
    type: Object,
    default: null,
  },
  loadDiff: {
    type: Function,
    default: null,
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
  'accept',
  'reject',
  'retry',
  'dismiss-failed',
  'load-run',
  'continue',
  'checklist-change',
  'run',
])

const editing = ref(false)
const editTitle = ref('')
const editInputRef = ref(null)
const continueInputRef = ref(null)
const expanded = ref(false)
const continueOpen = ref(false)
const continueFeedback = ref('')
const pendingReviewNote = ref('')
const pendingChecklist = ref(null)
let committing = false

const canContinueAccepted = computed(
  () =>
    Boolean(props.todo?.done) &&
    Boolean(props.todo?.lastRunId) &&
    props.todo?.runStatus !== 'queued' &&
    props.todo?.runStatus !== 'running' &&
    props.todo?.runStatus !== 'pending_review',
)

const canRun = computed(
  () =>
    props.canRunAgents &&
    !props.todo?.done &&
    props.todo?.runStatus !== 'queued' &&
    props.todo?.runStatus !== 'running' &&
    props.todo?.runStatus !== 'pending_review',
)

const statusKey = computed(() => {
  if (props.todo?.done) return 'done'
  if (props.todo?.runStatus === 'pending_review') return 'pending_review'
  if (props.todo?.runStatus === 'running' || props.todo?.runStatus === 'queued') return 'running'
  return 'idle'
})

const statusText = computed(() => {
  if (props.todo?.done) return '已完成'
  if (props.todo?.runStatus === 'pending_review') return '待验收'
  if (props.todo?.runStatus === 'running' || props.todo?.runStatus === 'queued') return '执行中'
  return '未完成'
})

const nowTick = ref(Date.now())
let tickTimer = null

const parseDateTime = (value) => {
  const text = String(value || '').trim()
  if (!text) return NaN
  const normalized = text.includes('T') ? text : text.replace(' ', 'T')
  const ms = Date.parse(normalized)
  if (Number.isFinite(ms)) return ms
  return Date.parse(text.replace(/-/g, '/'))
}

const formatTokenCount = (n) => {
  const num = Number(n) || 0
  if (num >= 10000) return `${(num / 1000).toFixed(num >= 100000 ? 0 : 1)}k`
  return String(num)
}

const formatDurationMs = (ms) => {
  const total = Math.max(0, Math.round(Number(ms) || 0))
  const sec = Math.floor(total / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  if (min < 60) return rem ? `${min}分${rem}秒` : `${min}分`
  const hour = Math.floor(min / 60)
  const remMin = min % 60
  return remMin ? `${hour}小时${remMin}分` : `${hour}小时`
}

const tokenLabel = computed(() => {
  const usage = props.runDetail?.usage
  if (!usage) return ''
  const input = Number(usage.inputTokens) || 0
  const output = Number(usage.outputTokens) || 0
  const total = Number(usage.totalTokens) || input + output
  if (!total && !input && !output) return ''
  return formatTokenCount(total || input + output)
})

const durationLabel = computed(() => {
  const startedAt = props.runDetail?.startedAt
  if (!startedAt) return ''
  const startMs = parseDateTime(startedAt)
  if (!Number.isFinite(startMs)) return ''

  const finishedAt = props.runDetail?.finishedAt
  const isRunning =
    props.todo?.runStatus === 'running' || props.todo?.runStatus === 'queued'
  const endMs = finishedAt && !isRunning
    ? parseDateTime(finishedAt)
    : nowTick.value
  if (!Number.isFinite(endMs) || endMs < startMs) return ''
  return formatDurationMs(endMs - startMs)
})

const metricsVisible = computed(() => Boolean(tokenLabel.value || durationLabel.value))

const syncTickTimer = () => {
  const isRunning =
    props.todo?.runStatus === 'running' || props.todo?.runStatus === 'queued'
  if (isRunning && props.runDetail?.startedAt) {
    if (!tickTimer) {
      tickTimer = window.setInterval(() => {
        nowTick.value = Date.now()
      }, 1000)
    }
    return
  }
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

onMounted(syncTickTimer)
watch(
  () => [props.todo?.runStatus, props.runDetail?.startedAt, props.runDetail?.finishedAt],
  () => {
    nowTick.value = Date.now()
    syncTickTimer()
  },
)
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
})

const onChecklistChange = (list) => {
  pendingChecklist.value = list
  emit('checklist-change', { todo: props.todo, checklist: list })
}

const onReviewNoteChange = (note) => {
  pendingReviewNote.value = note
}

const emitAccept = () => {
  emit('accept', {
    todo: props.todo,
    reviewNote: pendingReviewNote.value,
    checklist: pendingChecklist.value,
  })
}

const openContinue = async () => {
  continueOpen.value = true
  continueFeedback.value = ''
  await nextTick()
  continueInputRef.value?.focus?.()
}

const closeContinue = () => {
  continueOpen.value = false
  continueFeedback.value = ''
}

const submitContinue = () => {
  if (props.busy) return
  emit('continue', {
    todo: props.todo,
    feedback: String(continueFeedback.value || '').trim(),
  })
  closeContinue()
}

const runningPulse = { opacity: [1, 0.72, 1] }
const runningTransition = { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }

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
  background: rgba(24, 24, 27, 0.04);
  border-color: rgba(24, 24, 27, 0.22);
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

.todo-item-metrics {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.todo-metric {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.todo-metric svg {
  flex: 0 0 auto;
  color: var(--color-secondary-text);
}

.todo-metric strong {
  font-weight: 700;
  letter-spacing: 0.2px;
}

.todo-metric-unit {
  color: var(--color-secondary-text);
  font-weight: 500;
}

.todo-item-row.is-done .todo-item-title {
  text-decoration: line-through;
  color: var(--color-secondary-text);
}

.todo-status-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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

.todo-status-text.is-idle {
  background: rgba(100, 116, 139, 0.12);
  color: #64748b;
}

.todo-status-text.is-running {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.todo-status-text.is-pending_review {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
}

.todo-status-text.is-done {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.todo-run-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
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

.todo-run-detail {
  margin-top: 8px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.03);
  border: 1px solid var(--color-border);
}

.todo-continue-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.02);
}

.todo-continue-input {
  width: 100%;
  resize: vertical;
  min-height: 52px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-primary);
  background: var(--color-bg, #fff);
  box-sizing: border-box;
}

.todo-continue-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.todo-continue-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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

.todo-action-btn.is-danger:hover:not(:disabled) {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.06);
  color: var(--color-error);
}

.todo-action-btn:hover:not(:disabled):not(.is-danger) {
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
