/**
 * Cursor SDK / npm 在 Windows 上 spawn 子进程时经常不带 windowsHide，
 * 导致 CMD/npm 黑框狂闪；有的还会常驻。
 *
 * 在加载 @cursor/sdk 之前给 child_process 全量打补丁：
 * - 强制 windowsHide
 * - shell:true 改写为显式 cmd.exe + shell:false（避免 Electron/部分 Node 下 shell 路径漏藏窗）
 */
import childProcess from 'node:child_process'

let patched = false

function withWindowsHide(options) {
  if (options == null || typeof options !== 'object') {
    return { windowsHide: true }
  }
  return { ...options, windowsHide: true }
}

function normalizeArgs(command, args, options) {
  if (args != null && !Array.isArray(args)) {
    return { command, args: undefined, options: args }
  }
  return { command, args, options }
}

function quoteForCmd(command) {
  const text = String(command || '')
  if (!text) return '""'
  // 与 Node shell:true 类似：整体包一层引号，内部 " 加倍
  return `"${text.replace(/"/g, '""')}"`
}

function rewriteShellSpawn(originalSpawn, command, args, options) {
  const opts = withWindowsHide(options)
  if (!opts.shell || process.platform !== 'win32') {
    if (args === undefined) return originalSpawn.call(childProcess, command, opts)
    return originalSpawn.call(childProcess, command, args, opts)
  }

  const comSpec = process.env.ComSpec || 'cmd.exe'
  const parts = [String(command || '')]
  if (Array.isArray(args) && args.length) {
    for (const part of args) parts.push(String(part))
  }
  const line = parts.filter((p) => p.length > 0).join(' ')
  // 对齐 Node shell:true：带引号 + windowsVerbatimArguments，避免二次转义把命令弄坏
  const next = {
    ...opts,
    shell: false,
    windowsVerbatimArguments: true,
  }
  return originalSpawn.call(childProcess, comSpec, ['/d', '/s', '/c', quoteForCmd(line)], next)
}

function patchSpawnLike(originalSpawn) {
  return function patchedSpawn(command, args, options) {
    const normalized = normalizeArgs(command, args, options)
    return rewriteShellSpawn(
      originalSpawn,
      normalized.command,
      normalized.args,
      normalized.options,
    )
  }
}

function patchExecLike(originalExec) {
  return function patchedExec(command, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = undefined
    }
    return originalExec.call(childProcess, command, withWindowsHide(options), callback)
  }
}

function patchExecFileLike(originalExecFile) {
  return function patchedExecFile(file, args, options, callback) {
    if (typeof args === 'function') {
      callback = args
      args = undefined
      options = undefined
    } else if (args != null && !Array.isArray(args)) {
      callback = options
      options = args
      args = undefined
    } else if (typeof options === 'function') {
      callback = options
      options = undefined
    }
    const next = withWindowsHide(options)
    if (args === undefined) {
      return originalExecFile.call(childProcess, file, next, callback)
    }
    return originalExecFile.call(childProcess, file, args, next, callback)
  }
}

function patchExecFileSyncLike(original) {
  return function patchedExecFileSync(file, args, options) {
    if (args != null && !Array.isArray(args)) {
      options = args
      args = undefined
    }
    const next = withWindowsHide(options)
    if (args === undefined) return original.call(childProcess, file, next)
    return original.call(childProcess, file, args, next)
  }
}

function patchExecSyncLike(original) {
  return function patchedExecSync(command, options) {
    return original.call(childProcess, command, withWindowsHide(options))
  }
}

export function ensureWindowsHideConsole() {
  if (patched || process.platform !== 'win32') return false
  patched = true

  childProcess.spawn = patchSpawnLike(childProcess.spawn)
  childProcess.spawnSync = patchSpawnLike(childProcess.spawnSync)
  childProcess.exec = patchExecLike(childProcess.exec)
  childProcess.execSync = patchExecSyncLike(childProcess.execSync)
  childProcess.execFile = patchExecFileLike(childProcess.execFile)
  childProcess.execFileSync = patchExecFileSyncLike(childProcess.execFileSync)

  return true
}

const applied = ensureWindowsHideConsole()
if (applied) {
  // eslint-disable-next-line no-console
  console.log('[lanbitou-agent-bridge] windowsHideConsole: patched child_process')
}
