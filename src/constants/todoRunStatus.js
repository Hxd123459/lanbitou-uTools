export const TODO_RUN_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  RUNNING: 'running',
  PENDING_REVIEW: 'pending_review',
  FAILED: 'failed',
}

export const TODO_RUN_STATUS_LABEL = {
  idle: '',
  queued: '排队中',
  running: '进行中',
  pending_review: '待验收',
  failed: '失败',
}

/** 待办列表展示用状态 key（与筛选项 done / idle / pending_review 等区分） */
export const TODO_DISPLAY_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  RUNNING: 'running',
  PENDING_REVIEW: 'pending_review',
  DONE: 'done',
  FAILED: 'failed',
}

export const TODO_DISPLAY_STATUS_LABEL = {
  idle: '未完成',
  queued: '排队中',
  running: '进行中',
  pending_review: '待验收',
  done: '已验收',
  failed: '失败',
}

/** continueTodo 入队时的 startOptions（含 feedback / prevRun） */
export function isContinueQueuedStartOptions(opts) {
  if (!opts || typeof opts !== 'object') return false
  return (
    Object.prototype.hasOwnProperty.call(opts, 'feedback') || opts.prevRun != null
  )
}

/**
 * 统一待办展示状态（未完成 / 进行中 / 排队中 / 待验收 / 已验收 / 失败）
 * @returns {{ key: string, text: string }}
 */
export function getTodoDisplayStatus(todo, { isContinueQueued = false } = {}) {
  if (todo?.done) {
    return { key: TODO_DISPLAY_STATUS.DONE, text: TODO_DISPLAY_STATUS_LABEL.done }
  }

  const runStatus = normalizeTodoRunStatus(todo?.runStatus)

  if (runStatus === TODO_RUN_STATUS.PENDING_REVIEW) {
    return {
      key: TODO_DISPLAY_STATUS.PENDING_REVIEW,
      text: TODO_DISPLAY_STATUS_LABEL.pending_review,
    }
  }
  if (runStatus === TODO_RUN_STATUS.FAILED) {
    return { key: TODO_DISPLAY_STATUS.FAILED, text: TODO_DISPLAY_STATUS_LABEL.failed }
  }
  if (runStatus === TODO_RUN_STATUS.RUNNING) {
    // 进行中靠行样式区分，不挂文字徽章
    return { key: TODO_DISPLAY_STATUS.RUNNING, text: '' }
  }
  if (runStatus === TODO_RUN_STATUS.QUEUED) {
    if (isContinueQueued) {
      return { key: 'queued_continue', text: '继续改·排队中' }
    }
    // 普通排队靠行样式区分，不挂文字徽章
    return { key: TODO_DISPLAY_STATUS.QUEUED, text: '' }
  }

  return { key: TODO_DISPLAY_STATUS.IDLE, text: TODO_DISPLAY_STATUS_LABEL.idle }
}

export function normalizeTodoRunStatus(value) {
  const key = String(value || '').trim()
  if (Object.values(TODO_RUN_STATUS).includes(key)) return key
  return TODO_RUN_STATUS.IDLE
}

/** 应用重启后无对应队列/轮询的 runStatus（需重置为 idle） */
export function isOrphanRunStatus(value) {
  const key = normalizeTodoRunStatus(value)
  return key === TODO_RUN_STATUS.RUNNING || key === TODO_RUN_STATUS.QUEUED
}

/** 导入备份时将 running/queued 归一化为 idle */
export function normalizeImportedTodoRunStatus(value) {
  return isOrphanRunStatus(value) ? TODO_RUN_STATUS.IDLE : normalizeTodoRunStatus(value)
}
