/** 当前 todo 的执行会话是否已被 cancelActive 终止 */
export function wasRunSessionCancelled(activeTodoId, todoId) {
  if (activeTodoId == null || activeTodoId === '') return true
  return String(activeTodoId) !== String(todoId)
}

/** endPoll 后应跳过后续 poll tick 写入 */
export function shouldSkipPollTick(releasePoll) {
  return !releasePoll
}
