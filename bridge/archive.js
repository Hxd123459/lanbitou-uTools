import fs from 'node:fs'
import path from 'node:path'

function assertArchiveRoot(archivePath) {
  const root = path.resolve(String(archivePath || '').trim())
  if (!root) {
    const err = new Error('缺少 archivePath')
    err.code = 'BAD_REQUEST'
    throw err
  }
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
  }
  if (!fs.statSync(root).isDirectory()) {
    const err = new Error('archivePath 不是目录')
    err.code = 'INVALID_PATH'
    throw err
  }
  return root
}

function safeResolve(root, relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.includes('..')) {
    const err = new Error('非法相对路径')
    err.code = 'BAD_PATH'
    throw err
  }
  const abs = path.resolve(root, rel)
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (abs !== root && !abs.startsWith(rootWithSep)) {
    const err = new Error('路径越界')
    err.code = 'PATH_ESCAPE'
    throw err
  }
  return abs
}

export function ensureArchiveStructure(archivePath) {
  const root = assertArchiveRoot(archivePath)
  const dirs = ['runs', 'daily']
  for (const d of dirs) {
    const p = path.join(root, d)
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
  }
  const files = {
    'README.md': '# 事情档案\n\n（由烂笔头自动维护）\n',
    'changelog.md': '# Changelog\n\n',
    'decisions.md': '# 决策记录\n\n',
  }
  for (const [name, content] of Object.entries(files)) {
    const p = path.join(root, name)
    if (!fs.existsSync(p)) fs.writeFileSync(p, content, 'utf8')
  }
  return { ok: true, root }
}

export function writeArchiveFile(archivePath, relativePath, content, { append = false } = {}) {
  const root = assertArchiveRoot(archivePath)
  const abs = safeResolve(root, relativePath)
  const dir = path.dirname(abs)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const text = String(content ?? '')
  if (append) {
    fs.appendFileSync(abs, text, 'utf8')
  } else {
    fs.writeFileSync(abs, text, 'utf8')
  }
  return { ok: true, path: abs, relativePath: relativePath.replace(/\\/g, '/') }
}

export function syncProjectReadme(archivePath, project = {}) {
  ensureArchiveStructure(archivePath)
  const lines = [
    `# ${project.name || '事情'}`,
    '',
    '## 为什么做 / 初衷',
    '',
    project.purpose || '（未填写）',
    '',
    '## 怎样算值了',
    '',
    project.successLooksLike || '（未填写）',
    '',
    '## 明确不做',
    '',
    project.outOfScope || '（未填写）',
    '',
  ]
  return writeArchiveFile(archivePath, 'README.md', `${lines.join('\n')}\n`)
}

export function syncDecisionsFile(archivePath, decisions = []) {
  ensureArchiveStructure(archivePath)
  const list = Array.isArray(decisions) ? decisions : []
  const lines = ['# 决策记录', '']
  if (!list.length) {
    lines.push('（暂无）', '')
  } else {
    for (const item of list) {
      const at = item?.at || ''
      const text = item?.text || ''
      lines.push(`- **${at}**：${text}`)
    }
    lines.push('')
  }
  return writeArchiveFile(archivePath, 'decisions.md', `${lines.join('\n')}`)
}

export function writeRunSummary(archivePath, runMeta = {}) {
  ensureArchiveStructure(archivePath)
  const id = String(runMeta.id || Date.now())
  const lines = [
    `# Run ${id}`,
    '',
    `- 待办：${runMeta.todoTitle || ''}`,
    `- 状态：${runMeta.status || ''}`,
    `- 时间：${runMeta.finishedAt || runMeta.startedAt || ''}`,
    `- 分支：${runMeta.branchName || '-'}`,
    `- baseRef：${runMeta.baseRef || '-'}`,
    '',
    '## 摘要',
    '',
    runMeta.summary || '（无）',
    '',
  ]
  if (runMeta.reviewNote) {
    lines.push('## 验收备注', '', runMeta.reviewNote, '')
  }
  if (Array.isArray(runMeta.checklist) && runMeta.checklist.length) {
    lines.push('## 验收清单', '')
    for (const item of runMeta.checklist) {
      const mark = item?.checked ? 'x' : ' '
      lines.push(`- [${mark}] ${item?.text || item}`)
    }
    lines.push('')
  }
  if (Array.isArray(runMeta.changedFiles) && runMeta.changedFiles.length) {
    lines.push('## 改动文件', '')
    for (const f of runMeta.changedFiles) lines.push(`- ${f}`)
    lines.push('')
  }
  if (runMeta.usage) {
    lines.push(
      '## Token',
      '',
      `输入 ${runMeta.usage.inputTokens || 0} / 输出 ${runMeta.usage.outputTokens || 0} / 合计 ${runMeta.usage.totalTokens || 0}`,
      '',
    )
  }
  return writeArchiveFile(archivePath, `runs/${id}.md`, `${lines.join('\n')}`)
}

export function appendChangelog(archivePath, line) {
  ensureArchiveStructure(archivePath)
  const text = String(line || '').trim()
  if (!text) return { ok: true, skipped: true }
  const stamp = new Date().toISOString().slice(0, 10)
  return writeArchiveFile(archivePath, 'changelog.md', `- ${stamp} ${text}\n`, { append: true })
}

export function appendDaily(archivePath, dateStr, content) {
  ensureArchiveStructure(archivePath)
  const day = String(dateStr || new Date().toISOString().slice(0, 10))
  return writeArchiveFile(archivePath, `daily/${day}.md`, `${String(content || '').trim()}\n\n`, {
    append: true,
  })
}
