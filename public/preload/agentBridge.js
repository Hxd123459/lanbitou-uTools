/**
 * Agent bridge helpers for uTools preload (CommonJS).
 * 注意：uTools/Electron 下 process.execPath 是宿主程序，不能用来跑 bridge。
 */
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const DEFAULT_PORT = 39281
const HOST = '127.0.0.1'
const HEALTH_PATH = '/health'

let bridgeProcess = null
let startingPromise = null
let installingPromise = null

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
    // 关键：Windows 下 shell:true 会弹/残留 CMD 窗口
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
  if (hasBridgeDeps(root)) return root
  if (installingPromise) return installingPromise

  installingPromise = Promise.resolve().then(() => {
    if (hasBridgeDeps(root)) return root
    runNpmInstall(root)
    if (!hasBridgeDeps(root)) {
      throw new Error('Agent 桥依赖安装后仍不可用，请检查 bridge 目录')
    }
    return root
  })

  try {
    return await installingPromise
  } finally {
    installingPromise = null
  }
}

function getServerEntry() {
  return path.join(getBridgeRoot(), 'server.js')
}

function getSpawnLogPath() {
  return path.join(getBridgeRoot(), 'bridge-spawn.log')
}

function readSpawnLogTail(maxChars = 1200) {
  try {
    const logPath = getSpawnLogPath()
    if (!fs.existsSync(logPath)) return ''
    const text = fs.readFileSync(logPath, 'utf8')
    return text.slice(-maxChars).trim()
  } catch {
    return ''
  }
}

function requestHttp(method, urlPath, body, headers = {}, options = {}) {
  const payload = body == null ? null : JSON.stringify(body)
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 120000
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
        timeout: timeoutMs,
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
      reject(new Error(`agent bridge 请求超时（${Math.round(timeoutMs / 1000)}s）`))
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

async function healthInfo() {
  try {
    const result = await requestHttp('GET', HEALTH_PATH)
    if (result.status === 200 && result.data?.ok === true) return result.data
  } catch {
    /* ignore */
  }
  return null
}

/** 旧 bridge（无控制台会话）会导致 SDK shell 狂弹窗，需要换掉 */
function isBridgeLauncherOk(info) {
  if (process.platform !== 'win32') return true
  const launcher = String(info?.launcher || '')
  return launcher === 'conhost-headless' || launcher === 'node-with-console'
}

function killListenerOnPort(port) {
  if (process.platform !== 'win32') return false
  try {
    const listed = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
      ],
      { encoding: 'utf8', windowsHide: true, shell: false },
    )
    const pids = String(listed.stdout || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
    let killed = false
    for (const pid of pids) {
      const r = spawnSync('taskkill.exe', ['/PID', pid, '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true,
        shell: false,
      })
      if (r.status === 0) killed = true
    }
    return killed
  } catch {
    return false
  }
}

function getConhostPath() {
  if (process.platform !== 'win32') return null
  const candidates = [
    path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'conhost.exe'),
    'C:\\Windows\\System32\\conhost.exe',
  ]
  for (let i = 0; i < candidates.length; i += 1) {
    if (fs.existsSync(candidates[i])) return candidates[i]
  }
  return null
}

function spawnBridge() {
  const entry = getServerEntry()
  if (!fs.existsSync(entry)) {
    throw new Error(`找不到 bridge/server.js：${entry}`)
  }

  const nodeBin = resolveNodeBinary()
  const root = getBridgeRoot()
  let launcher = 'node'
  if (process.platform === 'win32') {
    launcher = getConhostPath() ? 'conhost-headless' : 'node-with-console'
  }

  const env = {
    ...process.env,
    LANBITOU_AGENT_BRIDGE_PORT: String(DEFAULT_PORT),
    LANBITOU_AGENT_BRIDGE_HOST: HOST,
    LANBITOU_BRIDGE_LAUNCHER: launcher,
  }

  const logPath = getSpawnLogPath()
  fs.writeFileSync(
    logPath,
    `\n===== spawn ${new Date().toISOString()} =====\nnode=${nodeBin}\nentry=${entry}\ncwd=${root}\nlauncher=${launcher}\n`,
    { flag: 'a' },
  )
  const outFd = fs.openSync(logPath, 'a')

  /**
   * Windows 关键：不能用 CREATE_NO_WINDOW 把 bridge 变成「无控制台」进程。
   * Cursor SDK 的 shell/npm 会挂到父进程控制台；没有可继承控制台时就会疯狂弹新 CMD。
   * 手动在终端启动之所以不弹窗，就是因为有控制台可继承。
   * conhost --headless = 有控制台会话、无可见窗口（Win10+）。
   */
  let child
  if (process.platform === 'win32') {
    const conhost = getConhostPath()
    if (conhost) {
      child = spawn(conhost, ['--headless', nodeBin, entry], {
        cwd: root,
        env,
        stdio: ['ignore', outFd, outFd],
        detached: true,
        windowsHide: true,
        shell: false,
      })
    } else {
      child = spawn(nodeBin, [entry], {
        cwd: root,
        env,
        stdio: ['ignore', outFd, outFd],
        detached: true,
        windowsHide: false,
        shell: false,
      })
    }
  } else {
    child = spawn(nodeBin, [entry], {
      cwd: root,
      env,
      stdio: ['ignore', outFd, outFd],
      detached: true,
      shell: false,
    })
  }

  child.on('error', (error) => {
    try {
      fs.appendFileSync(logPath, `[spawn error] ${error.message}\n`)
    } catch {
      /* ignore */
    }
  })

  child.unref()
  bridgeProcess = child
  return { child, nodeBin, entry, root, launcher }
}

async function waitUntilHealthy({ tries = 20, intervalMs = 250 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    if (await healthCheck()) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

async function ensureStarted() {
  const info = await healthInfo()
  if (info && isBridgeLauncherOk(info)) {
    return { ok: true, already: true, port: DEFAULT_PORT, launcher: info.launcher }
  }
  if (info && !isBridgeLauncherOk(info)) {
    // 旧 bridge 无正确控制台会话 → 杀掉换新
    killListenerOnPort(DEFAULT_PORT)
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  if (startingPromise) return startingPromise

  startingPromise = (async () => {
    try {
      await ensureBridgeDeps()
      // 启动前再清一次，避免端口占用
      if (await healthCheck()) {
        killListenerOnPort(DEFAULT_PORT)
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      const spawned = spawnBridge()
      const ok = await waitUntilHealthy({ tries: 40, intervalMs: 500 })
      if (!ok) {
        const tail = readSpawnLogTail()
        const hint = tail ? `\n日志：${tail}` : ''
        throw new Error(
          `Agent 桥启动超时（node=${spawned.nodeBin}, launcher=${spawned.launcher}）。请确认 Node.js 可用且端口 ${DEFAULT_PORT} 空闲。${hint}`,
        )
      }
      return {
        ok: true,
        already: false,
        port: DEFAULT_PORT,
        launcher: spawned.launcher,
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

module.exports = {
  DEFAULT_PORT,
  ensureStarted,
  request,
  pickDirectory,
  pathExists,
  revealInFolder,
  healthCheck,
  resolveNodeBinary,
}
