import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import cursorProvider from './providers/cursor.js'
import claudeProvider from './providers/claude.js'
import codexProvider from './providers/codex.js'
import { createId, readJsonBody, sendJson } from './utils.js'

const PORT = Number(process.env.LANBITOU_AGENT_BRIDGE_PORT || 39281)
const HOST = process.env.LANBITOU_AGENT_BRIDGE_HOST || '127.0.0.1'

const providers = {
  cursor: cursorProvider,
  claude: claudeProvider,
  codex: codexProvider,
}

/** @type {Map<string, any>} */
const runs = new Map()

function resolveProvider(name) {
  const key = String(name || 'cursor').trim().toLowerCase()
  return providers[key] || null
}

function assertCwd(cwd) {
  const dir = String(cwd || '').trim()
  if (!dir) {
    const err = new Error('缺少 cwd')
    err.code = 'BAD_REQUEST'
    throw err
  }
  const resolved = path.resolve(dir)
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    const err = new Error(`本地路径不存在或不是目录: ${resolved}`)
    err.code = 'INVALID_CWD'
    throw err
  }
  return resolved
}

function getApiKey(req, body = {}) {
  return String(
    req.headers['x-cursor-api-key'] ||
      body.apiKey ||
      process.env.CURSOR_API_KEY ||
      '',
  ).trim()
}

async function handleExtract(req, res) {
  const body = await readJsonBody(req)
  const providerName = body.provider || req.headers['x-agent-provider'] || 'cursor'
  const provider = resolveProvider(providerName)
  if (!provider) {
    sendJson(res, 400, { ok: false, error: `未知 provider: ${providerName}` })
    return
  }
  const cwd = assertCwd(body.cwd)
  const apiKey = getApiKey(req, body)
  try {
    const result = await provider.extract({
      cwd,
      notes: body.notes || [],
      apiKey,
      model: body.model,
    })
    sendJson(res, 200, { ok: true, provider: provider.id, ...result })
  } catch (error) {
    const code = error?.code || 'EXTRACT_FAILED'
    const status = code === 'NOT_IMPLEMENTED' ? 501 : code === 'NO_API_KEY' ? 401 : 500
    sendJson(res, status, { ok: false, code, error: error?.message || String(error) })
  }
}

async function handleRunCreate(req, res) {
  const body = await readJsonBody(req)
  const providerName = body.provider || req.headers['x-agent-provider'] || 'cursor'
  const provider = resolveProvider(providerName)
  if (!provider) {
    sendJson(res, 400, { ok: false, error: `未知 provider: ${providerName}` })
    return
  }
  const cwd = assertCwd(body.cwd)
  const apiKey = getApiKey(req, body)
  const prompt = String(body.prompt || '').trim()
  if (!prompt) {
    sendJson(res, 400, { ok: false, error: '缺少 prompt' })
    return
  }

  const bridgeRunId = createId()
  const record = {
    id: bridgeRunId,
    todoId: body.todoId || null,
    provider: provider.id,
    status: 'running',
    log: '',
    summary: '',
    changedFiles: [],
    agentId: null,
    error: '',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    handle: null,
  }
  runs.set(bridgeRunId, record)

  try {
    const handle = await provider.execute({
      cwd,
      prompt,
      apiKey,
      model: body.model,
      onEvent: (event) => {
        if (!event) return
        if (event.type === 'log') record.log = event.log || record.log
        if (event.type === 'agent') record.agentId = event.agentId || record.agentId
        if (event.type === 'done') {
          record.status = event.status || 'finished'
          record.log = event.log || record.log
          record.summary = event.summary || record.summary
          record.changedFiles = event.changedFiles || record.changedFiles
          record.agentId = event.agentId || record.agentId
          record.error = event.error || record.error
          record.finishedAt = new Date().toISOString()
        }
      },
    })
    record.handle = handle
    if (handle?.id) record.providerRunId = handle.id
  } catch (error) {
    record.status = 'error'
    record.error = error?.message || String(error)
    record.finishedAt = new Date().toISOString()
    const code = error?.code || 'RUN_FAILED'
    const status = code === 'NOT_IMPLEMENTED' ? 501 : code === 'NO_API_KEY' ? 401 : 500
    sendJson(res, status, {
      ok: false,
      code,
      error: record.error,
      run: publicRun(record),
    })
    return
  }

  sendJson(res, 200, { ok: true, run: publicRun(record) })
}

function publicRun(record) {
  const live = record.handle?.getState?.() || {}
  return {
    id: record.id,
    todoId: record.todoId,
    provider: record.provider,
    status: live.status || record.status,
    log: live.log || record.log,
    summary: live.summary || record.summary,
    changedFiles: live.changedFiles || record.changedFiles,
    agentId: live.agentId || record.agentId,
    error: live.error || record.error,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  }
}

async function handleRunGet(_req, res, id) {
  const record = runs.get(id)
  if (!record) {
    sendJson(res, 404, { ok: false, error: 'run 不存在' })
    return
  }
  sendJson(res, 200, { ok: true, run: publicRun(record) })
}

async function handleRunCancel(_req, res, id) {
  const record = runs.get(id)
  if (!record) {
    sendJson(res, 404, { ok: false, error: 'run 不存在' })
    return
  }
  try {
    await record.handle?.cancel?.()
  } catch {
    /* ignore */
  }
  record.status = 'cancelled'
  record.finishedAt = record.finishedAt || new Date().toISOString()
  sendJson(res, 200, { ok: true, run: publicRun(record) })
}

function matchRoute(urlPath) {
  if (urlPath === '/health') return { name: 'health' }
  if (urlPath === '/extract') return { name: 'extract' }
  if (urlPath === '/run') return { name: 'runCreate' }
  const runMatch = urlPath.match(/^\/run\/([^/]+)(?:\/(cancel))?$/)
  if (runMatch) {
    return {
      name: runMatch[2] === 'cancel' ? 'runCancel' : 'runGet',
      id: decodeURIComponent(runMatch[1]),
    }
  }
  return null
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }

    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)
    const route = matchRoute(url.pathname)

    if (!route) {
      sendJson(res, 404, { ok: false, error: 'not found' })
      return
    }

    if (route.name === 'health' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'lanbitou-agent-bridge',
        providers: Object.keys(providers),
      })
      return
    }

    if (route.name === 'extract' && req.method === 'POST') {
      await handleExtract(req, res)
      return
    }

    if (route.name === 'runCreate' && req.method === 'POST') {
      await handleRunCreate(req, res)
      return
    }

    if (route.name === 'runGet' && req.method === 'GET') {
      await handleRunGet(req, res, route.id)
      return
    }

    if (route.name === 'runCancel' && req.method === 'POST') {
      await handleRunCancel(req, res, route.id)
      return
    }

    sendJson(res, 405, { ok: false, error: 'method not allowed' })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error?.message || String(error) })
  }
})

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[lanbitou-agent-bridge] listening on http://${HOST}:${PORT}`)
})
