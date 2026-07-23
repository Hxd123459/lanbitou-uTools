import { isUtoolsMode } from '../storage/env'
import * as utoolsProject from '../storage/utools/projectRepository'
import { ApiError } from './http'

function notSupported() {
  throw new ApiError('NOT_SUPPORTED', '待办功能仅在 uTools 模式下可用')
}

export async function fetchProjects(options = {}) {
  if (!isUtoolsMode()) return []
  return utoolsProject.listProjects(options)
}

export async function fetchProject(id) {
  if (!isUtoolsMode()) return null
  return utoolsProject.getProject(id)
}

export async function createProject(payload) {
  if (!isUtoolsMode()) notSupported()
  return utoolsProject.createProject(payload)
}

export async function updateProject(id, patch) {
  if (!isUtoolsMode()) notSupported()
  return utoolsProject.updateProject(id, patch)
}

export async function deleteProject(id) {
  if (!isUtoolsMode()) notSupported()
  return utoolsProject.deleteProjectToRecycle(id)
}

export async function restoreProject(id) {
  if (!isUtoolsMode()) notSupported()
  return utoolsProject.restoreProject(id)
}
