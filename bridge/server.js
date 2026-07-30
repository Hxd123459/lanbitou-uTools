import { isWindowsHideConsolePatched } from './winHideConsole.js'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import cursorProvider from './providers/cursor.js'
import claudeProvider from './providers/claude.js'
import codexProvider from './providers/codex.js'
import {
  captureBaseline,
  createWorkBranch,
  getDiff,
  getStatus,
} from './git.js'
import {
  appendChangelog,
  appendDaily,
  ensureArchiveStructure,
  syncDecisionsFile,
  syncProjectReadme,
  writeArchiveFile,
  writeRunSummary,
} from './archive.js'
import { createId, readJsonBody, sendJson } from './utils.js'

// Agent shell 会继承这些环境；压低 npm 进度条/交互
if (process.platform === 'win32') {
  process.env.npm_config_progress = process.env.npm_config_progress || 'false'
  process.env.npm_config_loglevel = process.env.npm_config_loglevel || 'error'
  process.env.npm_config_fund = process.env.npm_config_fund || 'false'
  process.env.CI = process.env.CI || '1'
}

const PORT = Number(process.env.LANBITOU_AGENT_BRIDGE_PORT || 39281)
const HOST = process.env.LANBITOU_AGENT_BRIDGE_HOST || '127.0.0.1'
const LAUNCHER = String(process.env.LANBITOU_BRIDGE_LAUNCHER || 'unknown')

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

  let branchName = String(body.branchName || '').trim() || null
  let baseline = null
  try {
    if (body.createBranch && branchName) {
      createWorkBranch(cwd, branchName)
    }
    baseline = captureBaseline(cwd)
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      code: error?.code || 'GIT_SETUP_FAILED',
      error: error?.message || String(error),
    })
    return
  }

  const bridgeRunId = createId()
  const resumeAgentId = String(body.agentId || '').trim() || null
  const record = {
    id: bridgeRunId,
    todoId: body.todoId || null,
    provider: provider.id,
    status: 'running',
    log: '',
    summary: '',
    changedFiles: [],
    checklist: [],
    usage: null,
    agentId: resumeAgentId,
    baseRef: baseline?.baseRef || null,
    branchName: branchName || baseline?.branch || null,
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
      agentId: resumeAgentId,
      onEvent: (event) => {
        if (!event) return
        if (event.type === 'log') record.log = event.log || record.log
        if (event.type === 'usage') record.usage = event.usage || record.usage
        if (event.type === 'agent') record.agentId = event.agentId || record.agentId
        if (event.type === 'done') {
          record.status = event.status || 'finished'
          record.log = event.log || record.log
          record.summary = event.summary || record.summary
          record.changedFiles = event.changedFiles || record.changedFiles
          record.checklist = event.checklist || record.checklist
          record.usage = event.usage || record.usage
          record.agentId = event.agentId || record.agentId
          record.error = event.error || record.error
          record.finishedAt = new Date().toISOString()
          // 结束后用 git 补全 changedFiles
          try {
            const diff = getDiff(cwd, { baseRef: record.baseRef })
            if (diff.isGit && diff.files?.length) {
              const fromGit = diff.files.map((f) => f.path)
              const merged = [...new Set([...(record.changedFiles || []), ...fromGit])]
              record.changedFiles = merged
            }
          } catch {
            /* ignore */
          }
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

  sendJson(res, 200, { ok: true, run: publicRun(record), baseline })
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
    checklist: live.checklist || record.checklist || [],
    usage: live.usage || record.usage || null,
    agentId: live.agentId || record.agentId,
    baseRef: record.baseRef || null,
    branchName: record.branchName || null,
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

async function handleGitBaseline(req, res) {
  const body = await readJsonBody(req)
  const cwd = assertCwd(body.cwd)
  const baseline = captureBaseline(cwd)
  sendJson(res, 200, { ok: true, baseline })
}

async function handleGitDiff(req, res) {
  const body = await readJsonBody(req)
  const cwd = assertCwd(body.cwd)
  const result = getDiff(cwd, {
    baseRef: body.baseRef,
    file: body.file,
  })
  sendJson(res, 200, { ok: true, ...result })
}

async function handleGitStatus(req, res) {
  const body = await readJsonBody(req)
  const cwd = assertCwd(body.cwd)
  sendJson(res, 200, { ok: true, ...getStatus(cwd) })
}

async function handleGitBranch(req, res) {
  const body = await readJsonBody(req)
  const cwd = assertCwd(body.cwd)
  const result = createWorkBranch(cwd, body.branchName)
  sendJson(res, 200, { ok: true, ...result })
}

async function handleArchive(req, res) {
  const body = await readJsonBody(req)
  const action = String(body.action || '').trim()
  const archivePath = String(body.archivePath || '').trim()
  if (!archivePath) {
    sendJson(res, 400, { ok: false, error: '缺少 archivePath' })
    return
  }

  try {
    if (action === 'ensure') {
      sendJson(res, 200, ensureArchiveStructure(archivePath))
      return
    }
    if (action === 'syncReadme') {
      sendJson(res, 200, syncProjectReadme(archivePath, body.project || {}))
      return
    }
    if (action === 'syncDecisions') {
      sendJson(res, 200, syncDecisionsFile(archivePath, body.decisions || []))
      return
    }
    if (action === 'writeRun') {
      sendJson(res, 200, writeRunSummary(archivePath, body.run || {}))
      return
    }
    if (action === 'appendChangelog') {
      sendJson(res, 200, appendChangelog(archivePath, body.line || ''))
      return
    }
    if (action === 'appendDaily') {
      sendJson(res, 200, appendDaily(archivePath, body.date, body.content || ''))
      return
    }
    if (action === 'write') {
      sendJson(
        res,
        200,
        writeArchiveFile(archivePath, body.relativePath, body.content || '', {
          append: Boolean(body.append),
        }),
      )
      return
    }
    sendJson(res, 400, { ok: false, error: `未知 action: ${action}` })
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      code: error?.code || 'ARCHIVE_FAILED',
      error: error?.message || String(error),
    })
  }
}

function matchRoute(urlPath) {
  if (urlPath === '/health') return { name: 'health' }
  if (urlPath === '/extract') return { name: 'extract' }
  if (urlPath === '/run') return { name: 'runCreate' }
  if (urlPath === '/git/baseline') return { name: 'gitBaseline' }
  if (urlPath === '/git/diff') return { name: 'gitDiff' }
  if (urlPath === '/git/status') return { name: 'gitStatus' }
  if (urlPath === '/git/branch') return { name: 'gitBranch' }
  if (urlPath === '/archive') return { name: 'archive' }
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
        launcher: LAUNCHER,
        port: PORT,
        host: HOST,
        childHidePatched: isWindowsHideConsolePatched(),
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

    if (route.name === 'gitBaseline' && req.method === 'POST') {
      await handleGitBaseline(req, res)
      return
    }

    if (route.name === 'gitDiff' && req.method === 'POST') {
      await handleGitDiff(req, res)
      return
    }

    if (route.name === 'gitStatus' && req.method === 'POST') {
      await handleGitStatus(req, res)
      return
    }

    if (route.name === 'gitBranch' && req.method === 'POST') {
      await handleGitBranch(req, res)
      return
    }

    if (route.name === 'archive' && req.method === 'POST') {
      await handleArchive(req, res)
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
