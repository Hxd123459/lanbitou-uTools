const FALLBACK_STATUS_ORDER = ['done', 'idle']

const FALLBACK_STATUS_SECTION = {
  daily: {
    done: '今日完成',
    idle: '未完成',
  },
  release: {
    done: '已完成',
    idle: '未完成',
  },
  retro: {
    done: '已完成',
    idle: '未完成',
  },
}

const STATUS_LABEL = {
  done: '已完成',
  idle: '未完成',
}

function todoDisplayKey(todo) {
  return todo?.done ? 'done' : 'idle'
}

function groupTodosByDisplayStatus(todos) {
  const groups = new Map()
  for (const todo of todos) {
    const key = todoDisplayKey(todo)
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
      const label = STATUS_LABEL[key]
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
