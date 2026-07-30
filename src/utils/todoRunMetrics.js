export function parseRunDateTime(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return NaN
  let ms = Date.parse(normalized)
  if (Number.isFinite(ms)) return ms
  ms = Date.parse(normalized.replace(/-/g, '/'))
  if (Number.isFinite(ms)) return ms
  if (/^\d{4}-\d{2}-\d{2} /.test(normalized)) {
    return Date.parse(normalized.replace(' ', 'T'))
  }
  return NaN
}

export function formatTokenCount(n) {
  const num = Number(n) || 0
  if (num >= 10000) return `${(num / 1000).toFixed(num >= 100000 ? 0 : 1)}k`
  return String(num)
}

export function formatDurationMs(ms) {
  const total = Math.max(0, Math.round(Number(ms) || 0))
  const sec = Math.floor(total / 1000)
  if (sec < 60) return `${sec}秒`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  if (min < 60) return rem ? `${min}分${rem}秒` : `${min}分`
  const hour = Math.floor(min / 60)
  const remMin = min % 60
  return remMin ? `${hour}小时${remMin}分` : `${hour}小时`
}

/** 估算 Cursor 类模型费用（元），按 input/output 分项 */
export function estimateUsageCostCny(usage) {
  if (!usage || typeof usage !== 'object') return 0
  const input = Number(usage.inputTokens) || 0
  const output = Number(usage.outputTokens) || 0
  const cacheRead = Number(usage.cacheReadTokens) || 0
  const cacheWrite = Number(usage.cacheWriteTokens) || 0
  const total = Number(usage.totalTokens) || input + output + cacheRead + cacheWrite
  if (!total && !input && !output) return 0
  return (
    (input * 2.1) / 1e6 +
    (output * 6.3) / 1e6 +
    (cacheRead * 0.42) / 1e6 +
    (cacheWrite * 2.1) / 1e6
  )
}

export function isRunDurationLive(run, todo = null) {
  if (!run || run.finishedAt) return false
  const runStatus = String(run.status || '').toLowerCase()
  if (runStatus === 'running') return true
  if (todo?.runStatus === 'running' && String(todo.lastRunId || '') === String(run.id)) {
    return true
  }
  return false
}

export function getRunDurationMs(run, nowMs = Date.now(), todo = null) {
  const startMs = parseRunDateTime(run?.startedAt)
  if (!Number.isFinite(startMs)) return 0

  const finishedAt = run?.finishedAt
  if (finishedAt) {
    const endMs = parseRunDateTime(finishedAt)
    if (!Number.isFinite(endMs) || endMs < startMs) return 0
    return endMs - startMs
  }

  if (!isRunDurationLive(run, todo)) return 0

  return Math.max(0, nowMs - startMs)
}

export function getRunTotalTokens(usage) {
  if (!usage || typeof usage !== 'object') return 0
  const input = Number(usage.inputTokens) || 0
  const output = Number(usage.outputTokens) || 0
  const cacheRead = Number(usage.cacheReadTokens) || 0
  const cacheWrite = Number(usage.cacheWriteTokens) || 0
  return Number(usage.totalTokens) || input + output + cacheRead + cacheWrite
}

/** 与 TodoItemRow 一致的单个待办指标 */
export function getTodoMetrics(todo, runDetail, nowMs = Date.now()) {
  if (!runDetail) {
    return { totalTokens: 0, totalDurationMs: 0, costCny: 0 }
  }

  const seen = new Set()
  let totalTokens = 0
  let totalDurationMs = 0
  let costCny = 0

  const addRun = (run) => {
    if (!run?.id || seen.has(run.id)) return
    seen.add(run.id)
    totalTokens += getRunTotalTokens(run.usage)
    totalDurationMs += getRunDurationMs(run, nowMs, todo)
    costCny += estimateUsageCostCny(run.usage)
  }

  if (Array.isArray(runDetail.history)) {
    for (const run of runDetail.history) addRun(run)
  }
  addRun(runDetail)

  return { totalTokens, totalDurationMs, costCny }
}

export const STATS_CHART_DAYS = 15

function toDateKeyFromMs(ms) {
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addCalendarDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function collectTodoRuns(runDetail) {
  const seen = new Set()
  const runs = []
  const addRun = (run) => {
    if (!run?.id || seen.has(run.id)) return
    seen.add(run.id)
    runs.push(run)
  }
  if (Array.isArray(runDetail?.history)) {
    for (const run of runDetail.history) addRun(run)
  }
  addRun(runDetail)
  return runs
}

/** 按 startedAt 自然日汇总 token / 耗时，返回连续 days 天（含零值日） */
export function aggregateProjectMetricsByDay(
  todos = [],
  runDetails = {},
  days = STATS_CHART_DAYS,
  nowMs = Date.now(),
) {
  const dayCount = Math.max(1, Number(days) || STATS_CHART_DAYS)
  const rangeEnd = new Date(nowMs)
  rangeEnd.setHours(0, 0, 0, 0)

  const bucketMap = new Map()
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = addCalendarDays(rangeEnd, -offset)
    const dateKey = toDateKeyFromMs(date.getTime())
    bucketMap.set(dateKey, { dateKey, totalTokens: 0, totalDurationMs: 0 })
  }

  for (const todo of todos || []) {
    const detail = runDetails?.[String(todo.id)] || null
    if (!detail) continue
    for (const run of collectTodoRuns(detail)) {
      const startMs = parseRunDateTime(run?.startedAt)
      if (!Number.isFinite(startMs)) continue
      const dateKey = toDateKeyFromMs(startMs)
      const bucket = bucketMap.get(dateKey)
      if (!bucket) continue
      bucket.totalTokens += getRunTotalTokens(run.usage)
      bucket.totalDurationMs += getRunDurationMs(run, nowMs, todo)
    }
  }

  return Array.from(bucketMap.values())
}

/** 汇总事情下各待办指标（与列表行展示同源） */
export function aggregateProjectTodoMetrics(todos = [], runDetails = {}, nowMs = Date.now()) {
  let totalTokens = 0
  let totalDurationMs = 0
  let costCny = 0
  for (const todo of todos || []) {
    const detail = runDetails?.[String(todo.id)] || null
    const metrics = getTodoMetrics(todo, detail, nowMs)
    totalTokens += metrics.totalTokens
    totalDurationMs += metrics.totalDurationMs
    costCny += metrics.costCny
  }
  return { totalTokens, totalDurationMs, costCny }
}

export function formatCostCny(amount) {
  const n = Number(amount) || 0
  if (n <= 0) return '¥0'
  if (n < 0.01) return '< ¥0.01'
  if (n < 10) return `¥${n.toFixed(2)}`
  if (n < 100) return `¥${n.toFixed(1)}`
  return `¥${Math.round(n)}`
}
