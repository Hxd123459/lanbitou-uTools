import { TODO_RUN_STATUS } from '../constants/todoRunStatus.js'

/**
 * 展示排序：runStatus=running 的待办置顶，其余保持原相对顺序。
 * @param {Array<{ runStatus?: string }>} todos
 */
export function pinRunningTodosFirst(todos) {
  if (!Array.isArray(todos) || todos.length <= 1) return Array.isArray(todos) ? todos : []

  const running = []
  const rest = []
  for (const todo of todos) {
    if (todo?.runStatus === TODO_RUN_STATUS.RUNNING) {
      running.push(todo)
    } else {
      rest.push(todo)
    }
  }
  if (!running.length) return todos
  return [...running, ...rest]
}
