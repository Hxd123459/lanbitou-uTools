import { TODO_RUN_STATUS } from '../constants/todoRunStatus.js'

export function buildCancelledRunPatch(finishedAt) {
  return { status: 'cancelled', finishedAt }
}

export function isTerminalRunStatus(status) {
  const key = String(status || '')
  return key === 'finished' || key === 'error' || key === 'cancelled'
}

/** bridge run 终态 → 待办 runStatus */
export function mapTerminalRunToTodoRunStatus(runStatus) {
  const key = String(runStatus || '')
  if (key === 'finished') return TODO_RUN_STATUS.PENDING_REVIEW
  if (key === 'cancelled') return TODO_RUN_STATUS.IDLE
  if (key === 'error') return TODO_RUN_STATUS.FAILED
  return TODO_RUN_STATUS.IDLE
}
