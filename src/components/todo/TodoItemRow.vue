<template>
  <li
    class="todo-item-row"
    :class="{
      'is-done': todo.done,
      'is-editing': editing,
      'is-selected': selected,
      'is-expanded': expanded,
      'is-select-mode': selectMode,
    }"
  >
    <button
      v-if="selectMode"
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

    <button
      v-else
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
        maxlength="240"
        :disabled="busy"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @blur="commitEdit"
      />
      <p v-else class="todo-item-title" @dblclick="startEdit">{{ todo.title }}</p>

      <div class="todo-item-meta">
        <motion.span
          v-if="runStatusLabel"
          class="todo-run-badge"
          :class="`is-${todo.runStatus}`"
          :animate="todo.runStatus === 'running' ? runningPulse : undefined"
          :transition="todo.runStatus === 'running' ? runningTransition : undefined"
        >
          <span v-if="todo.runStatus === 'running'" class="todo-run-dot" aria-hidden="true" />
          {{ runStatusLabel }}
        </motion.span>
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

      <div v-if="showReviewActions" class="todo-review-actions">
        <template v-if="todo.runStatus === 'pending_review'">
          <button
            type="button"
            class="todo-review-btn is-primary"
            :disabled="busy"
            @click="emitAccept"
          >
            通过
          </button>
          <button type="button" class="todo-review-btn" :disabled="busy" @click="openContinue">
            继续改
          </button>
        </template>
        <template v-else-if="todo.runStatus === 'failed'">
          <button type="button" class="todo-review-btn" :disabled="busy" @click="emit('retry', todo)">
            重试
          </button>
          <button type="button" class="todo-review-btn" :disabled="busy" @click="emit('dismiss-failed', todo)">
            忽略
          </button>
        </template>
        <template v-else-if="canContinueAccepted">
          <button type="button" class="todo-review-btn" :disabled="busy" @click="openContinue">
            继续改
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
          <button type="button" class="todo-review-btn is-primary" :disabled="busy" @click="submitContinue">
            提交修改
          </button>
          <button type="button" class="todo-review-btn" :disabled="busy" @click="closeContinue">
            取消
          </button>
        </div>
      </div>
    </div>

    <div class="todo-item-actions">
      <motion.button
        v-if="!editing && hasRunHistory"
        type="button"
        class="icon-btn"
        :title="`执行日志${runHistoryCount > 1 ? ` (${runHistoryCount})` : ''}`"
        aria-label="执行日志"
        :disabled="busy"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="openLogModal"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      </motion.button>
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

    <Teleport to="body">
      <AnimatePresence>
        <motion.div
          v-if="logModalVisible"
          key="todo-log-modal"
          class="todo-log-modal"
          role="dialog"
          aria-modal="true"
          aria-label="执行日志"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 0.18 }"
        >
          <motion.div
            class="todo-log-modal-backdrop"
            aria-hidden="true"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            @click="closeLogModal"
          />
          <motion.div
            class="todo-log-modal-card"
            :initial="{ opacity: 0, y: 16, scale: 0.98 }"
            :animate="{ opacity: 1, y: 0, scale: 1 }"
            :exit="{ opacity: 0, y: 12, scale: 0.98 }"
            :transition="{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }"
          >
            <header class="todo-log-modal-header">
              <h3 class="todo-log-modal-title">执行日志</h3>
              <p class="todo-log-modal-desc">{{ todo.title }}</p>
            </header>
            <div class="todo-log-modal-body">
              <p v-if="logLoading" class="todo-run-summary is-muted">加载日志…</p>
              <template v-else-if="runHistory.length">
                <div v-for="(run, index) in runHistory" :key="run.id || index" class="todo-log-entry">
                  <p class="todo-log-entry-head">
                    <span>{{ formatRunTime(run) }}</span>
                    <span class="todo-log-entry-status">{{ runStatusText(run.status) }}</span>
                  </p>
                  <p v-if="run.summary" class="todo-run-summary">{{ run.summary }}</p>
                  <p v-if="run.error" class="todo-run-error">{{ run.error }}</p>
                  <p v-if="usageText(run)" class="todo-run-usage">{{ usageText(run) }}</p>
                  <p v-if="run.changedFiles?.length" class="todo-run-files">
                    改动文件：{{ run.changedFiles.join('、') }}
                  </p>
                  <pre v-if="run.log" class="todo-run-log">{{ run.log }}</pre>
                  <p v-else class="todo-run-summary is-muted">暂无日志内容</p>
                </div>
              </template>
              <p v-else class="todo-run-summary is-muted">暂无执行记录</p>
            </div>
            <div class="todo-log-modal-actions">
              <motion.button
                type="button"
                class="todo-log-modal-close-btn"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="closeLogModal"
              >
                关闭
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </Teleport>
  </li>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { TODO_RUN_STATUS_LABEL } from '../../constants/todoRunStatus'
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
  selectMode: {
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
  loadDiff: {
    type: Function,
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
  'continue',
  'checklist-change',
])
const { presets } = useMotionPresets()

const editing = ref(false)
const editTitle = ref('')
const editInputRef = ref(null)
const continueInputRef = ref(null)
const expanded = ref(false)
const logModalVisible = ref(false)
const logLoading = ref(false)
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

const showReviewActions = computed(
  () =>
    props.todo?.runStatus === 'pending_review' ||
    props.todo?.runStatus === 'failed' ||
    canContinueAccepted.value,
)

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

const usageText = (run) => {
  const usage = run?.usage
  if (!usage) return ''
  const input = Number(usage.inputTokens) || 0
  const output = Number(usage.outputTokens) || 0
  const total = Number(usage.totalTokens) || input + output
  if (!total && !input && !output) return ''
  return `Token：输入 ${input} / 输出 ${output} / 合计 ${total}`
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

const runStatusLabel = computed(
  () => TODO_RUN_STATUS_LABEL[props.todo?.runStatus] || '',
)

const runHistory = computed(() => {
  const history = props.runDetail?.history
  if (Array.isArray(history) && history.length) return history
  if (props.runDetail?.id) return [props.runDetail]
  return []
})

const runHistoryCount = computed(() => runHistory.value.length)

const hasRunHistory = computed(
  () => Boolean(props.todo?.lastRunId) || runHistoryCount.value > 0,
)

const runStatusText = (status) => {
  const key = String(status || '')
  return TODO_RUN_STATUS_LABEL[key] || key || '未知'
}

const formatRunTime = (run) => {
  const time = run?.finishedAt || run?.startedAt || run?.createTime
  if (!time) return '执行记录'
  return String(time).replace('T', ' ').slice(0, 19)
}

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

const openLogModal = () => {
  logModalVisible.value = true
  if (runHistoryCount.value) return
  logLoading.value = true
  emit('load-run', props.todo)
}

const closeLogModal = () => {
  logModalVisible.value = false
}

watch(
  () => props.runDetail,
  () => {
    if (logLoading.value) logLoading.value = false
  },
)
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

.todo-item-row.is-select-mode .todo-item-check:not(.is-checked) {
  border-color: rgba(37, 99, 235, 0.35);
}

.todo-item-row.is-select-mode .todo-item-check.is-checked {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.55);
  color: var(--color-accent);
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
  gap: 5px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
}

.todo-run-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
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

.todo-log-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.todo-log-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(24, 24, 27, 0.28);
}

.todo-log-modal-card {
  position: relative;
  z-index: 1;
  width: min(560px, 100%);
  max-height: min(72vh, 640px);
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.todo-log-modal-header {
  margin-bottom: 12px;
}

.todo-log-modal-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.todo-log-modal-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-secondary-text);
  word-break: break-word;
}

.todo-log-modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.todo-log-modal-close-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.todo-log-modal-close-btn:hover {
  border-color: var(--btn-icon-border-hover);
  background: var(--btn-icon-bg-hover);
}

.todo-run-detail {
  margin-top: 8px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.03);
  border: 1px solid var(--color-border);
}

.todo-log-modal-body {
  max-height: 320px;
  overflow: auto;
}

.todo-log-entry + .todo-log-entry {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--color-border);
}

.todo-log-entry-head {
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--color-secondary-text);
}

.todo-log-entry-status {
  color: var(--color-accent);
  font-weight: 500;
}

.todo-run-summary,
.todo-run-error,
.todo-run-files,
.todo-run-usage {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.todo-run-usage {
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.todo-run-summary.is-muted {
  color: rgba(24, 24, 27, 0.4);
}

.todo-run-error {
  color: var(--color-error);
}

.todo-run-log {
  margin: 0;
  max-height: none;
  overflow: visible;
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
