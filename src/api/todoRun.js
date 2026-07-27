import { isUtoolsMode } from '../storage/env'
import * as utoolsRun from '../storage/utools/runRepository'
import { ApiError } from './http'

function notSupported() {
  throw new ApiError('NOT_SUPPORTED', '待办功能仅在 uTools 模式下可用')
}

export async function createTodoRun(payload) {
  if (!isUtoolsMode()) notSupported()
  return utoolsRun.createTodoRun(payload)
}

export async function fetchTodoRun(id) {
  if (!isUtoolsMode()) return null
  return utoolsRun.getTodoRun(id)
}

export async function updateTodoRun(id, patch) {
  if (!isUtoolsMode()) notSupported()
  return utoolsRun.updateTodoRun(id, patch)
}

export async function fetchTodoRunsByTodo(todoId, options = {}) {
  if (!isUtoolsMode()) return []
  return utoolsRun.listTodoRunsByTodo(todoId, options)
}

export async function fetchTodoRunsByProject(projectId, options = {}) {
  if (!isUtoolsMode()) return []
  return utoolsRun.listTodoRunsByProject(projectId, options)
}
