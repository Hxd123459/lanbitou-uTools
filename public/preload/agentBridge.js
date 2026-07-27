/**
 * Agent bridge helpers for uTools preload (CommonJS).
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const DEFAULT_PORT = 39281
const HOST = '127.0.0.1'
const HEALTH_PATH = '/health'

let bridgeProcess = null
let startingPromise = null

function getBridgeRootCandidates() {
  return [
    path.resolve(__dirname, '..', '..', 'bridge'), // repo root / public→../..
    path.resolve(__dirname, '..', 'bridge'), // dist/bridge
    path.resolve(process.cwd(), 'bridge'),
  ]
}

function getBridgeRoot() {
  const candidates = getBridgeRootCandidates()
  for (let i = 0; i < candidates.length; i += 1) {
    const root = candidates[i]
    if (fs.existsSync(path.join(root, 'server.js'))) return root
  }
  return candidates[0]
}

function getServerEntry() {
  return path.join(getBridgeRoot(), 'server.js')
}

function requestHttp(method, urlPath, body, headers = {}) {
  const payload = body == null ? null : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: DEFAULT_PORT,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload
            ? { 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...headers,
        },
        timeout: 120000,
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let data = null
          try {
            data = raw ? JSON.parse(raw) : {}
          } catch {
            data = { ok: false, error: raw || 'invalid json' }
          }
          resolve({
            status: res.statusCode || 0,
            data,
          })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('agent bridge 请求超时'))
    })
    if (payload) req.write(payload)
    req.end()
  })
}

async function healthCheck() {
  try {
    const result = await requestHttp('GET', HEALTH_PATH)
    return result.status === 200 && result.data?.ok === true
  } catch {
    return false
  }
}

function spawnBridge() {
  const entry = getServerEntry()
  if (!fs.existsSync(entry)) {
    throw new Error(`找不到 bridge/server.js：${entry}`)
  }

  const env = {
    ...process.env,
    LANBITOU_AGENT_BRIDGE_PORT: String(DEFAULT_PORT),
    LANBITOU_AGENT_BRIDGE_HOST: HOST,
  }

  const child = spawn(process.execPath || 'node', [entry], {
    cwd: getBridgeRoot(),
    env,
    stdio: 'ignore',
    detached: true,
    windowsHide: true,
  })
  child.unref()
  bridgeProcess = child
  return child
}

async function waitUntilHealthy({ tries = 20, intervalMs = 250 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    if (await healthCheck()) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

async function ensureStarted() {
  if (await healthCheck()) {
    return { ok: true, already: true, port: DEFAULT_PORT }
  }
  if (startingPromise) return startingPromise

  startingPromise = (async () => {
    try {
      spawnBridge()
      const ok = await waitUntilHealthy()
      if (!ok) throw new Error('Agent 桥启动超时，请在 bridge 目录手动 npm start')
      return { ok: true, already: false, port: DEFAULT_PORT }
    } finally {
      startingPromise = null
    }
  })()

  return startingPromise
}

async function request(method, urlPath, body, headers = {}) {
  await ensureStarted()
  return requestHttp(method, urlPath, body, headers)
}

function pickDirectory() {
  const api =
    (typeof utools !== 'undefined' && utools) ||
    (typeof window !== 'undefined' && window.utools) ||
    null
  if (!api || typeof api.showOpenDialog !== 'function') {
    throw new Error('当前环境不支持选择目录')
  }
  const result = api.showOpenDialog({
    title: '选择本地项目目录',
    properties: ['openDirectory'],
  })
  if (!result || !result.length) return null
  return String(result[0] || '').trim() || null
}

function pathExists(target) {
  const text = String(target || '').trim()
  if (!text) return false
  try {
    return fs.existsSync(text) && fs.statSync(text).isDirectory()
  } catch {
    return false
  }
}

module.exports = {
  DEFAULT_PORT,
  ensureStarted,
  request,
  pickDirectory,
  pathExists,
  healthCheck,
}
