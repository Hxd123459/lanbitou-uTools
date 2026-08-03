const FALLBACK_STATUS_ORDER = ['done', 'idle']

const FALLBACK_STATUS_SECTION = {
  todo_daily: {
    done: '今日完成',
    idle: '未完成',
  },
  daily: {
    done: '今日完成',
    idle: '未完成',
  },
  todo_release: {
    done: '已完成',
    idle: '未完成',
  },
  release: {
    done: '已完成',
    idle: '未完成',
  },
  default: {
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
  const sections = FALLBACK_STATUS_SECTION[template] || FALLBACK_STATUS_SECTION.default
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

export function fallbackGenerate(template, project, todos, label = '') {
  const title = project?.name || '事情'
  const heading = String(label || '').trim() || '产出'
  const key = String(template || '')
  const isRelease = key === 'todo_release' || key === 'release'
  const sectionKey = FALLBACK_STATUS_SECTION[key] ? key : 'default'
  const prefix = isRelease ? '###' : '##'
  return [
    `# ${heading} · ${title}`,
    '',
    ...buildFallbackGroupedLines(sectionKey, todos, prefix),
    '',
  ].join('\n')
}
