/** 存在执行中任务时只入队，不触发 pump 抢占当前任务 */
export function shouldPumpAfterEnqueue(activeTodoId) {
  return activeTodoId == null || String(activeTodoId).trim() === ''
}
