import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const MAX_DIFF_CHARS = 120000
const MAX_FILE_DIFF_CHARS = 40000

function runGit(cwd, args, { maxBuffer = 8 * 1024 * 1024 } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer,
  })
  return {
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    error: result.error,
  }
}

export function isGitRepo(cwd) {
  const result = runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
  return result.status === 0 && result.stdout.trim() === 'true'
}

export function getHeadRef(cwd) {
  const result = runGit(cwd, ['rev-parse', 'HEAD'])
  if (result.status !== 0) return null
  return result.stdout.trim() || null
}

export function getCurrentBranch(cwd) {
  const result = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (result.status !== 0) return null
  const name = result.stdout.trim()
  return name && name !== 'HEAD' ? name : null
}

/**
 * 执行前基线：git 用 HEAD；非 git 用时间戳标记
 */
export function captureBaseline(cwd) {
  const dir = path.resolve(cwd)
  if (isGitRepo(dir)) {
    const baseRef = getHeadRef(dir)
    const branch = getCurrentBranch(dir)
    return {
      isGit: true,
      baseRef: baseRef || `nogit-${Date.now()}`,
      branch: branch || null,
      capturedAt: new Date().toISOString(),
    }
  }
  return {
    isGit: false,
    baseRef: `fs-${Date.now()}`,
    branch: null,
    capturedAt: new Date().toISOString(),
  }
}

export function createWorkBranch(cwd, branchName) {
  const dir = path.resolve(cwd)
  const name = String(branchName || '').trim()
  if (!name) {
    const err = new Error('缺少分支名')
    err.code = 'BAD_REQUEST'
    throw err
  }
  if (!isGitRepo(dir)) {
    return { ok: false, skipped: true, reason: 'not_git' }
  }
  const existing = runGit(dir, ['rev-parse', '--verify', name])
  if (existing.status === 0) {
    const checkout = runGit(dir, ['checkout', name])
    if (checkout.status !== 0) {
      const err = new Error(checkout.stderr || `无法切换到分支 ${name}`)
      err.code = 'GIT_CHECKOUT_FAILED'
      throw err
    }
    return { ok: true, branch: name, created: false }
  }
  const create = runGit(dir, ['checkout', '-b', name])
  if (create.status !== 0) {
    const err = new Error(create.stderr || `无法创建分支 ${name}`)
    err.code = 'GIT_BRANCH_FAILED'
    throw err
  }
  return { ok: true, branch: name, created: true }
}

function parseNameStatus(stdout) {
  return String(stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t/)
      const status = parts[0] || '?'
      const filePath = parts[parts.length - 1] || ''
      return { status, path: filePath }
    })
    .filter((item) => item.path)
}

/**
 * 相对基线的变更文件 + 可选单文件 diff
 */
export function getDiff(cwd, { baseRef = null, file = null } = {}) {
  const dir = path.resolve(cwd)
  if (!isGitRepo(dir)) {
    return {
      isGit: false,
      baseRef: baseRef || null,
      files: [],
      patch: '',
      message: '当前目录不是 git 仓库，无法展示 diff',
    }
  }

  const ref = String(baseRef || '').trim()
  const usableRef = ref && !ref.startsWith('fs-') && !ref.startsWith('nogit-') ? ref : 'HEAD'

  // 工作区相对 baseRef 的全部变更（含未提交）
  const nameStatus = runGit(dir, ['diff', '--name-status', usableRef])
  let files = parseNameStatus(nameStatus.stdout)

  // 未跟踪文件
  const untracked = runGit(dir, ['ls-files', '--others', '--exclude-standard'])
  for (const line of String(untracked.stdout || '').split(/\r?\n/)) {
    const p = line.trim()
    if (!p) continue
    if (!files.some((f) => f.path === p)) {
      files.push({ status: '??', path: p })
    }
  }

  let patch = ''
  const targetFile = String(file || '').trim()
  if (targetFile) {
    if (files.some((f) => f.path === targetFile && f.status === '??')) {
      try {
        const abs = path.join(dir, targetFile)
        const content = fs.readFileSync(abs, 'utf8')
        const body = content.length > MAX_FILE_DIFF_CHARS
          ? `${content.slice(0, MAX_FILE_DIFF_CHARS)}\n…(已截断)`
          : content
        patch = `--- /dev/null\n+++ b/${targetFile}\n${body
          .split(/\r?\n/)
          .map((l) => `+${l}`)
          .join('\n')}`
      } catch (error) {
        patch = `无法读取新文件：${error?.message || error}`
      }
    } else {
      const diff = runGit(dir, ['diff', usableRef, '--', targetFile])
      patch = String(diff.stdout || diff.stderr || '')
      if (patch.length > MAX_FILE_DIFF_CHARS) {
        patch = `${patch.slice(0, MAX_FILE_DIFF_CHARS)}\n…(diff 已截断)`
      }
    }
  } else {
    const diff = runGit(dir, ['diff', usableRef])
    patch = String(diff.stdout || '')
    if (patch.length > MAX_DIFF_CHARS) {
      patch = `${patch.slice(0, MAX_DIFF_CHARS)}\n…(diff 已截断)`
    }
  }

  return {
    isGit: true,
    baseRef: usableRef,
    files,
    patch,
    message: '',
  }
}

export function getStatus(cwd) {
  const dir = path.resolve(cwd)
  if (!isGitRepo(dir)) {
    return { isGit: false, branch: null, porcelain: '' }
  }
  const branch = getCurrentBranch(dir)
  const porcelain = runGit(dir, ['status', '--porcelain'])
  return {
    isGit: true,
    branch,
    porcelain: porcelain.stdout || '',
  }
}
