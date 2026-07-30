/**
 * Agent bridge helpers for uTools preload (CommonJS).
 * 桥改为常驻：插件只探活/连端口，不在后台偷偷 spawn。
 * 启动请用 startResident()（唯一最小化常驻窗）或手动运行 bridge/start-resident.cmd。
 */
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const DEFAULT_PORT = 39281
const HOST = '127.0.0.1'
const HEALTH_PATH = '/health'

let startingPromise = null

function getBridgeRootCandidates() {
  return [
    path.resolve(__dirname, '..', '..', 'bridge'), // public/preload 或 dist/preload → 项目根/bridge
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

function getResidentScript() {
  return path.join(getBridgeRoot(), 'start-resident.cmd')
}

function hasBridgeDeps(root) {
  return fs.existsSync(path.join(root, 'node_modules', '@cursor', 'sdk'))
}

function resolveViaWhere(command) {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which'
  const found = spawnSync(finder, [command], {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
  })
  if (found.status !== 0) return null
  return (
    String(found.stdout || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((line) => line && fs.existsSync(line)) || null
  )
}

function resolveNodeBinary() {
  const execPath = String(process.execPath || '')
  const base = path.basename(execPath).toLowerCase()
  if (base === 'node' || base === 'node.exe') {
    return execPath
  }

  const fromPath = resolveViaWhere('node')
  if (fromPath) return fromPath

  const fallbacks =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\nodejs\\node.exe',
          'C:\\Program Files (x86)\\nodejs\\node.exe',
        ]
      : ['/usr/local/bin/node', '/usr/bin/node']

  for (let i = 0; i < fallbacks.length; i += 1) {
    if (fs.existsSync(fallbacks[i])) return fallbacks[i]
  }

  throw new Error('未找到本机 Node.js，请安装 Node.js 并确保终端可执行 node')
}

/** Windows 上避免 `shell:true` 调 npm（会闪 CMD）；直接跑 npm.cmd */
function resolveNpmBinary() {
  if (process.platform !== 'win32') {
    return resolveViaWhere('npm') || 'npm'
  }
  const fromPath = resolveViaWhere('npm.cmd')
  if (fromPath) return fromPath
  const nodeDir = path.dirname(resolveNodeBinary())
  const candidate = path.join(nodeDir, 'npm.cmd')
  if (fs.existsSync(candidate)) return candidate
  return 'npm.cmd'
}

function runNpmInstall(root) {
  const lockFile = path.join(root, 'package-lock.json')
  const args = fs.existsSync(lockFile)
    ? ['ci', '--omit=dev']
    : ['install', '--omit=dev']
  const npmBin = resolveNpmBinary()
  const result = spawnSync(npmBin, args, {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      npm_config_progress: 'false',
      npm_config_loglevel: 'error',
    },
    shell: false,
  })
  if (result.error) {
    throw new Error(`Agent 桥依赖安装失败：${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error('Agent 桥依赖安装失败，请确认本机已安装 Node.js 与 npm')
  }
}

async function ensureBridgeDeps() {
  const root = getBridgeRoot()
  if (!fs.existsSync(path.join(root, 'server.js'))) {
    throw new Error(`找不到 bridge 目录：${root}`)
  }
  if (hasBridgeDeps(root)) return { root, installed: false }
  runNpmInstall(root)
  if (!hasBridgeDeps(root)) {
    throw new Error('Agent 桥依赖安装后仍不可用，请检查 bridge 目录')
  }
  return { root, installed: true }
}

function requestHttp(method, urlPath, body, headers = {}, options = {}) {
  const timeoutMs = Number(options.timeoutMs) || 15000
  const payload = body == null ? null : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOST,
        port: DEFAULT_PORT,
        path: urlPath,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let data = null
          try {
            data = raw ? JSON.parse(raw) : null
          } catch {
            data = { raw }
          }
          resolve({ status: res.statusCode || 0, data })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`agent bridge 请求超时（${Math.round(timeoutMs / 1000)}s）`))
    })
    if (payload) req.write(payload)
    req.end()
  })
}

async function healthCheck() {
  try {
    const result = await requestHttp('GET', HEALTH_PATH, undefined, {}, { timeoutMs: 2500 })
    return result.status === 200 && result.data?.ok === true
  } catch {
    return false
  }
}

async function healthInfo() {
  try {
    const result = await requestHttp('GET', HEALTH_PATH, undefined, {}, { timeoutMs: 2500 })
    if (result.status === 200 && result.data?.ok === true) return result.data
  } catch {
    /* ignore */
  }
  return null
}

async function getStatus() {
  const info = await healthInfo()
  if (info) {
    return {
      ok: true,
      online: true,
      port: DEFAULT_PORT,
      host: HOST,
      launcher: info.launcher || 'unknown',
      service: info.service || 'lanbitou-agent-bridge',
      providers: Array.isArray(info.providers) ? info.providers : [],
    }
  }
  return {
    ok: false,
    online: false,
    port: DEFAULT_PORT,
    host: HOST,
    launcher: null,
    service: null,
    providers: [],
  }
}

/**
 * 仅探测常驻服务是否在线；不自动拉起进程。
 */
async function ensureStarted() {
  const status = await getStatus()
  if (status.online) {
    return {
      ok: true,
      already: true,
      port: status.port,
      launcher: status.launcher,
    }
  }
  throw new Error(
    `Agent 桥未运行（${HOST}:${DEFAULT_PORT}）。请在事情页点击「启动」，或双击 bridge/start-resident.cmd`,
  )
}

async function waitUntilHealthy({ tries = 40, intervalMs = 500 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    if (await healthCheck()) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

function spawnResidentProcess() {
  const entry = getServerEntry()
  if (!fs.existsSync(entry)) {
    throw new Error(`找不到 bridge/server.js：${entry}`)
  }

  const nodeBin = resolveNodeBinary()
  const root = getBridgeRoot()
  const env = {
    ...process.env,
    LANBITOU_AGENT_BRIDGE_PORT: String(DEFAULT_PORT),
    LANBITOU_AGENT_BRIDGE_HOST: HOST,
    LANBITOU_BRIDGE_LAUNCHER: 'resident-min',
  }

  if (process.platform === 'win32') {
    const script = getResidentScript()
    if (fs.existsSync(script)) {
      // 脚本自身会 /min 再跑 --run；这里再带 /min 双保险，且已在线绝不进此函数
      const child = spawn(
        'cmd.exe',
        ['/c', 'start', '烂笔头 Agent 桥', '/min', 'cmd.exe', '/k', `"${script}" --run`],
        {
          cwd: root,
          env,
          detached: true,
          windowsHide: true,
          stdio: 'ignore',
          shell: false,
        },
      )
      child.unref()
      return { child, nodeBin, root, launcher: 'resident-min' }
    }
  }

  const child = spawn(nodeBin, [entry], {
    cwd: root,
    env,
    detached: true,
    windowsHide: false,
    stdio: 'ignore',
    shell: false,
  })
  child.unref()
  return { child, nodeBin, root, launcher: 'resident-min' }
}

/**
 * 显式启动「一个」最小化常驻窗。已在线则绝不重开。
 */
async function startResident() {
  if (startingPromise) return startingPromise

  startingPromise = (async () => {
    try {
      const existing = await getStatus()
      if (existing.online) {
        return {
          ok: true,
          already: true,
          port: existing.port,
          launcher: existing.launcher,
        }
      }

      await ensureBridgeDeps()

      // 依赖安装后可能已被别处拉起，再探一次，杜绝双窗
      const again = await getStatus()
      if (again.online) {
        return {
          ok: true,
          already: true,
          port: again.port,
          launcher: again.launcher,
        }
      }

      spawnResidentProcess()
      const ok = await waitUntilHealthy({ tries: 50, intervalMs: 400 })
      if (!ok) {
        throw new Error(
          `Agent 桥启动超时（端口 ${DEFAULT_PORT}）。请从任务栏打开最小化的「烂笔头 Agent 桥」窗口查看报错`,
        )
      }
      const info = await healthInfo()
      return {
        ok: true,
        already: false,
        port: DEFAULT_PORT,
        launcher: info?.launcher || 'resident-min',
      }
    } finally {
      startingPromise = null
    }
  })()

  return startingPromise
}

async function request(method, urlPath, body, headers = {}, options = {}) {
  await ensureStarted()
  return requestHttp(method, urlPath, body, headers, options)
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

function revealInFolder(target) {
  const text = String(target || '').trim()
  if (!text) return false
  const api =
    (typeof utools !== 'undefined' && utools) ||
    (typeof window !== 'undefined' && window.utools) ||
    null
  try {
    if (api && typeof api.shellOpenPath === 'function') {
      api.shellOpenPath(text)
      return true
    }
    if (api && typeof api.shellShowItemInFolder === 'function') {
      api.shellShowItemInFolder(text)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function openBridgeFolder() {
  return revealInFolder(getBridgeRoot())
}

module.exports = {
  DEFAULT_PORT,
  ensureStarted,
  startResident,
  getStatus,
  request,
  pickDirectory,
  pathExists,
  revealInFolder,
  openBridgeFolder,
  healthCheck,
  healthInfo,
  resolveNodeBinary,
  getBridgeRoot,
}
