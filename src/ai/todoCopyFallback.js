import {
  getTodoDisplayStatus,
  TODO_DISPLAY_STATUS_LABEL,
} from '../constants/todoRunStatus.js'

const FALLBACK_STATUS_ORDER = ['done', 'pending_review', 'running', 'queued', 'failed', 'idle']

const FALLBACK_STATUS_SECTION = {
  daily: {
    done: '今日完成',
    pending_review: '待验收',
    running: '进行中',
    queued: '排队中',
    failed: '风险或阻塞',
    idle: '未完成',
  },
  release: {
    done: '已验收',
    pending_review: '待验收',
    running: '进行中',
    queued: '排队中',
    failed: '失败',
    idle: '未完成',
  },
  retro: {
    done: '已验收',
    pending_review: '待验收',
    running: '进行中',
    queued: '排队中',
    failed: '失败',
    idle: '未完成',
  },
}

function groupTodosByDisplayStatus(todos) {
  const groups = new Map()
  for (const todo of todos) {
    const { key } = getTodoDisplayStatus(todo)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(todo)
  }
  return groups
}

function buildFallbackGroupedLines(template, todos, headingPrefix = '##') {
  const groups = groupTodosByDisplayStatus(todos)
  const sections = FALLBACK_STATUS_SECTION[template] || FALLBACK_STATUS_SECTION.daily
  const lines = []
  for (const key of FALLBACK_STATUS_ORDER) {
    const items = groups.get(key)
    if (!items?.length) continue
    lines.push(`${headingPrefix} ${sections[key]}`, '')
    for (const todo of items) {
      const label = TODO_DISPLAY_STATUS_LABEL[key]
      lines.push(label ? `- ${todo.title}（${label}）` : `- ${todo.title}`)
    }
    lines.push('')
  }
  return lines
}

export function fallbackGenerate(template, project, todos) {
  const title = project?.name || '事情'
  if (template === 'daily') {
    return [`# 日报 · ${title}`, '', ...buildFallbackGroupedLines('daily', todos), ''].join('\n')
  }
  if (template === 'release') {
    return [`# 版本说明 · ${title}`, '', ...buildFallbackGroupedLines('release', todos, '###'), ''].join('\n')
  }
  return [`# 复盘 · ${title}`, '', ...buildFallbackGroupedLines('retro', todos), ''].join('\n')
}
