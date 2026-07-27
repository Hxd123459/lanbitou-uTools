import { isUtoolsMode } from '../storage/env'
import { loadAiSettings } from '../storage/utools/aiSettings'

function getAgentService() {
  if (typeof window === 'undefined') return null
  return window.services?.agent || null
}

export function isAgentBridgeAvailable() {
  return Boolean(isUtoolsMode() && getAgentService())
}

function cursorHeaders(extra = {}) {
  const settings = loadAiSettings()
  const apiKey = String(settings.cursorApiKey || settings.apiKey || '').trim()
  const headers = { ...extra }
  if (apiKey) headers['x-cursor-api-key'] = apiKey
  return headers
}

export async function ensureAgentBridge() {
  const svc = getAgentService()
  if (!svc) throw new Error('Agent 桥不可用（需在 uTools 中运行）')
  return svc.ensureStarted()
}

export async function pickDirectory() {
  const svc = getAgentService()
  if (!svc?.pickDirectory) throw new Error('当前环境不支持选择目录')
  return svc.pickDirectory()
}

export function pathExists(target) {
  const svc = getAgentService()
  if (!svc?.pathExists) return false
  return svc.pathExists(target)
}

export async function agentBridgeRequest(method, urlPath, body = undefined, headers = {}) {
  const svc = getAgentService()
  if (!svc) throw new Error('Agent 桥不可用（需在 uTools 中运行）')
  await svc.ensureStarted()
  const result = await svc.request(method, urlPath, body, {
    ...cursorHeaders(),
    ...headers,
  })
  if (!result || result.status >= 400 || result.data?.ok === false) {
    const message = result?.data?.error || `Agent 桥请求失败 (${result?.status || 0})`
    const err = new Error(message)
    err.code = result?.data?.code || 'BRIDGE_ERROR'
    err.status = result?.status
    err.data = result?.data
    throw err
  }
  return result.data
}

export async function agentHealth() {
  try {
    const svc = getAgentService()
    if (!svc) return false
    return Boolean(await svc.healthCheck())
  } catch {
    return false
  }
}

export async function agentExtract({ cwd, notes, provider = 'cursor', model } = {}) {
  return agentBridgeRequest('POST', '/extract', {
    cwd,
    notes,
    provider,
    model,
  })
}

export async function agentStartRun({
  cwd,
  todoId,
  prompt,
  provider = 'cursor',
  model,
} = {}) {
  return agentBridgeRequest('POST', '/run', {
    cwd,
    todoId,
    prompt,
    provider,
    model,
  })
}

export async function agentGetRun(bridgeRunId) {
  return agentBridgeRequest('GET', `/run/${encodeURIComponent(bridgeRunId)}`)
}

export async function agentCancelRun(bridgeRunId) {
  return agentBridgeRequest('POST', `/run/${encodeURIComponent(bridgeRunId)}/cancel`)
}
