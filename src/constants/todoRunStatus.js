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
  running: '执行中',
  pending_review: '待验收',
  failed: '失败',
}

export function normalizeTodoRunStatus(value) {
  const key = String(value || '').trim()
  if (Object.values(TODO_RUN_STATUS).includes(key)) return key
  return TODO_RUN_STATUS.IDLE
}
