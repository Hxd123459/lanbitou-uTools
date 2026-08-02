/**
 * 待办展示排序占位：保持原相对顺序。
 * @param {Array} todos
 */
export function pinRunningTodosFirst(todos) {
  return Array.isArray(todos) ? todos : []
}
