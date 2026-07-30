import { isUtoolsMode } from '../storage/env'
import { loadAiSettings } from '../storage/utools/aiSettings'

function getAgentService() {
  if (typeof window === 'undefined') return null
  return window.services?.agent || null
}

export function isAgentBridgeAvailable() {
  return Boolean(isUtoolsMode() && getAgentService())
}

export function getAgentBridgePort() {
  const svc = getAgentService()
  return Number(svc?.port) || 39281
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

export async function getAgentBridgeStatus() {
  const svc = getAgentService()
  if (!svc?.getStatus) {
    return {
      ok: false,
      online: false,
      port: getAgentBridgePort(),
      host: '127.0.0.1',
      launcher: null,
      service: null,
      providers: [],
      unavailable: true,
    }
  }
  try {
    return await svc.getStatus()
  } catch {
    return {
      ok: false,
      online: false,
      port: getAgentBridgePort(),
      host: '127.0.0.1',
      launcher: null,
      service: null,
      providers: [],
    }
  }
}

export async function startAgentBridgeResident() {
  const svc = getAgentService()
  if (!svc?.startResident) throw new Error('当前环境不支持启动 Agent 桥')
  return svc.startResident()
}

export function openAgentBridgeFolder() {
  const svc = getAgentService()
  if (!svc?.openBridgeFolder) return false
  return svc.openBridgeFolder()
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

export function revealInFolder(target) {
  const svc = getAgentService()
  if (!svc?.revealInFolder) return false
  return svc.revealInFolder(target)
}

export async function agentBridgeRequest(method, urlPath, body = undefined, headers = {}, options = {}) {
  const svc = getAgentService()
  if (!svc) throw new Error('Agent 桥不可用（需在 uTools 中运行）')
  await svc.ensureStarted()
  const result = await svc.request(
    method,
    urlPath,
    body,
    {
      ...cursorHeaders(),
      ...headers,
    },
    options,
  )
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
    const status = await getAgentBridgeStatus()
    return Boolean(status.online)
  } catch {
    return false
  }
}

export async function agentExtract({ cwd, notes, provider = 'cursor', model } = {}) {
  return agentBridgeRequest(
    'POST',
    '/extract',
    {
      cwd,
      notes,
      provider,
      model,
    },
    {},
    { timeoutMs: 600000 },
  )
}

export async function agentStartRun({
  cwd,
  todoId,
  prompt,
  provider = 'cursor',
  model,
  agentId,
  createBranch = true,
  branchName,
} = {}) {
  return agentBridgeRequest('POST', '/run', {
    cwd,
    todoId,
    prompt,
    provider,
    model,
    agentId: agentId || undefined,
    createBranch: Boolean(createBranch),
    branchName: branchName || undefined,
  })
}

export async function agentGetRun(bridgeRunId) {
  return agentBridgeRequest('GET', `/run/${encodeURIComponent(bridgeRunId)}`)
}

export async function agentCancelRun(bridgeRunId) {
  return agentBridgeRequest('POST', `/run/${encodeURIComponent(bridgeRunId)}/cancel`)
}

export async function agentGitDiff({ cwd, baseRef, file } = {}) {
  return agentBridgeRequest('POST', '/git/diff', { cwd, baseRef, file })
}

export async function agentGitBaseline({ cwd } = {}) {
  return agentBridgeRequest('POST', '/git/baseline', { cwd })
}

export async function agentGitStatus({ cwd } = {}) {
  return agentBridgeRequest('POST', '/git/status', { cwd })
}

export async function agentArchive(payload = {}) {
  return agentBridgeRequest('POST', '/archive', payload)
}
