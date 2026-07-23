import { isUtoolsMode } from '../storage/env'
import * as utoolsTodo from '../storage/utools/todoRepository'
import { ApiError } from './http'

function notSupported() {
  throw new ApiError('NOT_SUPPORTED', '待办功能仅在 uTools 模式下可用')
}

export {
  buildTodoSourceHash,
  normalizeTodoTitle,
} from '../storage/utools/todoRepository'

export async function fetchTodosByProject(projectId, options = {}) {
  if (!isUtoolsMode()) return []
  return utoolsTodo.listTodosByProject(projectId, options)
}

export async function fetchTodoCountsByProject() {
  if (!isUtoolsMode()) return {}
  return utoolsTodo.countTodosByProject()
}

export async function createTodo(payload) {
  if (!isUtoolsMode()) notSupported()
  return utoolsTodo.createTodo(payload)
}

export async function updateTodo(id, patch) {
  if (!isUtoolsMode()) notSupported()
  return utoolsTodo.updateTodo(id, patch)
}

export async function toggleTodoDone(id) {
  if (!isUtoolsMode()) notSupported()
  return utoolsTodo.toggleTodoDone(id)
}

export async function deleteTodo(id) {
  if (!isUtoolsMode()) notSupported()
  return utoolsTodo.deleteTodoToRecycle(id)
}

export async function restoreTodo(id) {
  if (!isUtoolsMode()) notSupported()
  return utoolsTodo.restoreTodo(id)
}

export async function softDeleteTodosByProject(projectId) {
  if (!isUtoolsMode()) notSupported()
  return utoolsTodo.softDeleteTodosByProject(projectId)
}

export async function fetchTodosBySourceNoteIds(noteIds, options = {}) {
  if (!isUtoolsMode()) return []
  return utoolsTodo.listTodosBySourceNoteIds(noteIds, options)
}

export async function fetchSourceHashesByProject(projectId) {
  if (!isUtoolsMode()) return new Set()
  return utoolsTodo.listSourceHashesByProject(projectId)
}

export async function fetchNotesForTodoSync(payload) {
  if (!isUtoolsMode()) return []
  return utoolsTodo.listNotesForTodoSync(payload)
}
