<template>
  <div class="todo-run-review">
    <div v-if="historyRounds.length" class="todo-run-history">
      <p class="todo-run-section-title">执行轮次</p>
      <ul class="todo-run-history-list">
        <li
          v-for="round in historyRounds"
          :key="round.id"
          class="todo-run-history-item"
          :class="{ 'is-current': round.isCurrent }"
        >
          <div class="todo-run-history-head">
            <span class="todo-run-history-round">第 {{ round.roundNumber }} 轮</span>
            <span class="todo-run-history-status" :class="`is-${round.status}`">
              {{ round.statusLabel }}
            </span>
          </div>
          <p v-if="round.summary" class="todo-run-history-summary">{{ round.summary }}</p>
          <p v-else-if="round.error" class="todo-run-history-error">{{ round.error }}</p>
          <p v-else class="todo-run-history-summary is-muted">暂无摘要</p>
          <p v-if="round.feedback" class="todo-run-history-feedback">
            反馈：{{ round.feedback }}
          </p>
        </li>
      </ul>
    </div>

    <template v-else>
      <p v-if="runDetail?.summary" class="todo-run-summary">{{ runDetail.summary }}</p>
      <p v-else-if="runDetail?.error" class="todo-run-error">{{ runDetail.error }}</p>
      <p v-else class="todo-run-summary is-muted">暂无摘要</p>
    </template>

    <p v-if="usageLabel" class="todo-run-usage">{{ usageLabel }}</p>
    <p v-if="runDetail?.branchName || runDetail?.baseRef" class="todo-run-meta">
      <span v-if="runDetail.branchName">分支 {{ runDetail.branchName }}</span>
      <span v-if="runDetail.baseRef"> · base {{ shortRef(runDetail.baseRef) }}</span>
    </p>

    <div v-if="checklist.length" class="todo-run-checklist">
      <p class="todo-run-section-title">
        验收清单
        <span v-if="allChecked" class="todo-run-suggest">建议通过</span>
      </p>
      <label v-for="(item, index) in checklist" :key="index" class="todo-run-check-item">
        <input
          type="checkbox"
          :checked="item.checked"
          :disabled="busy"
          @change="toggleCheck(index, $event.target.checked)"
        />
        <span>{{ item.text }}</span>
      </label>
    </div>

    <div class="todo-run-diff-block">
      <div class="todo-run-diff-head">
        <p class="todo-run-section-title">改动 Diff</p>
        <button type="button" class="todo-review-btn" :disabled="busy || diffLoading" @click="reloadDiff">
          {{ diffLoading ? '加载中…' : '刷新' }}
        </button>
      </div>
      <p v-if="diffMessage" class="todo-run-summary is-muted">{{ diffMessage }}</p>
      <ul v-if="diffFiles.length" class="todo-run-file-list">
        <li v-for="file in diffFiles" :key="file.path">
          <button
            type="button"
            class="todo-run-file-btn"
            :class="{ 'is-active': selectedFile === file.path }"
            :disabled="busy"
            @click="selectFile(file.path)"
          >
            <span class="todo-run-file-status">{{ file.status }}</span>
            {{ file.path }}
          </button>
          <button type="button" class="todo-run-file-copy" :disabled="busy" @click="copyPath(file.path)">
            复制
          </button>
        </li>
      </ul>
      <p v-else-if="!diffLoading && !diffMessage" class="todo-run-summary is-muted">暂无文件变更</p>
      <pre v-if="diffPatch" class="todo-run-diff-patch">{{ diffPatch }}</pre>
    </div>

    <div v-if="showAcceptNote" class="todo-run-accept-note">
      <textarea
        v-model="localNote"
        class="todo-continue-input"
        rows="2"
        maxlength="500"
        placeholder="验收备注（可选）"
        :disabled="busy"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { revealInFolder } from '../../api/agentBridge'
import { buildRunHistoryRounds } from '../../utils/todoRunHistory'

const props = defineProps({
  todo: { type: Object, required: true },
  runDetail: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  showAcceptNote: { type: Boolean, default: false },
  loadDiff: { type: Function, default: null },
})

const emit = defineEmits(['checklist-change', 'review-note-change'])

const checklist = ref([])
const localNote = ref('')
const diffLoading = ref(false)
const diffFiles = ref([])
const diffPatch = ref('')
const diffMessage = ref('')
const selectedFile = ref('')

const usageLabel = computed(() => {
  const usage = props.runDetail?.usage
  if (!usage) return ''
  const input = Number(usage.inputTokens) || 0
  const output = Number(usage.outputTokens) || 0
  const total = Number(usage.totalTokens) || input + output
  if (!total && !input && !output) return ''
  return `Token：输入 ${input} / 输出 ${output} / 合计 ${total}`
})

const historyRounds = computed(() => buildRunHistoryRounds(props.runDetail))

const allChecked = computed(
  () => checklist.value.length > 0 && checklist.value.every((item) => item.checked),
)

const shortRef = (ref) => {
  const text = String(ref || '')
  return text.length > 12 ? `${text.slice(0, 8)}…` : text
}

const syncChecklist = () => {
  const list = Array.isArray(props.runDetail?.checklist) ? props.runDetail.checklist : []
  checklist.value = list.map((item) => ({
    text: item.text || String(item),
    checked: Boolean(item.checked),
  }))
}

const toggleCheck = (index, checked) => {
  const next = checklist.value.map((item, i) =>
    i === index ? { ...item, checked: Boolean(checked) } : item,
  )
  checklist.value = next
  emit('checklist-change', next)
}

watch(
  () => props.runDetail,
  () => {
    syncChecklist()
    localNote.value = props.runDetail?.reviewNote || ''
  },
  { immediate: true, deep: true },
)

watch(localNote, (value) => {
  emit('review-note-change', value)
})

const reloadDiff = async () => {
  if (!props.loadDiff) return
  diffLoading.value = true
  diffMessage.value = ''
  try {
    const data = await props.loadDiff(props.todo, selectedFile.value || null)
    diffFiles.value = Array.isArray(data?.files) ? data.files : []
    diffPatch.value = data?.patch || ''
    diffMessage.value = data?.message || ''
    if (!selectedFile.value && diffFiles.value[0]?.path) {
      selectedFile.value = diffFiles.value[0].path
      const one = await props.loadDiff(props.todo, selectedFile.value)
      diffPatch.value = one?.patch || diffPatch.value
    }
  } catch (error) {
    diffMessage.value = error?.message || '加载 diff 失败'
    diffFiles.value = []
    diffPatch.value = ''
  } finally {
    diffLoading.value = false
  }
}

const selectFile = async (filePath) => {
  selectedFile.value = filePath
  if (!props.loadDiff) return
  diffLoading.value = true
  try {
    const data = await props.loadDiff(props.todo, filePath)
    diffPatch.value = data?.patch || ''
  } catch (error) {
    diffPatch.value = error?.message || '加载失败'
  } finally {
    diffLoading.value = false
  }
}

const copyPath = async (filePath) => {
  try {
    await navigator.clipboard.writeText(filePath)
  } catch {
    /* ignore */
  }
}

watch(
  () => props.runDetail?.id,
  () => {
    selectedFile.value = ''
    void reloadDiff()
  },
  { immediate: true },
)

defineExpose({
  getReviewNote: () => String(localNote.value || '').trim(),
  getChecklist: () => checklist.value,
  revealLocal: () => revealInFolder(props.todo?.localPath),
})
</script>

<style scoped>
.todo-run-review {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-run-summary,
.todo-run-error,
.todo-run-usage,
.todo-run-meta {
  margin: 0;
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

.todo-run-usage {
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.todo-run-section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.todo-run-history-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-run-history-item {
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.02);
}

.todo-run-history-item.is-current {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.04);
}

.todo-run-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.todo-run-history-round {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary);
}

.todo-run-history-status {
  font-size: 11px;
  font-weight: 600;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.12);
  color: #64748b;
}

.todo-run-history-status.is-finished {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.todo-run-history-status.is-running {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.todo-run-history-status.is-error {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.todo-run-history-summary,
.todo-run-history-error,
.todo-run-history-feedback {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.todo-run-history-summary.is-muted {
  color: rgba(24, 24, 27, 0.4);
}

.todo-run-history-error {
  color: var(--color-error);
}

.todo-run-history-feedback {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(24, 24, 27, 0.55);
}

.todo-run-suggest {
  font-weight: 500;
  color: var(--color-accent);
  font-size: 11px;
}

.todo-run-checklist {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.todo-run-check-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.todo-run-diff-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-run-diff-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.todo-run-file-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 140px;
  overflow: auto;
}

.todo-run-file-list li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.todo-run-file-btn {
  flex: 1;
  min-width: 0;
  text-align: left;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  padding: 4px 8px;
  font: inherit;
  font-size: 11px;
  color: var(--color-secondary-text);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-run-file-btn.is-active {
  border-color: var(--color-accent);
  color: var(--color-primary);
}

.todo-run-file-status {
  margin-right: 6px;
  color: var(--color-accent);
  font-family: ui-monospace, monospace;
}

.todo-run-file-copy {
  border: none;
  background: transparent;
  color: var(--color-accent);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.todo-run-diff-patch {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  padding: 8px;
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.04);
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.todo-review-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.todo-continue-input {
  width: 100%;
  resize: vertical;
  min-height: 48px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  box-sizing: border-box;
}
</style>
