import { isContinueQueuedStartOptions } from '../constants/todoRunStatus.js'

/** 排队中更新继续改 feedback（纯函数，供 composable 与单测） */
export function patchQueuedContinueFeedback(startOptionsByTodoId, todoId, feedback) {
  const id = String(todoId || '').trim()
  if (!id) return null
  const opts = startOptionsByTodoId?.[id]
  if (!isContinueQueuedStartOptions(opts)) return null
  const text = String(feedback ?? '').trim()
  return {
    ...startOptionsByTodoId,
    [id]: { ...opts, feedback: text },
  }
}
