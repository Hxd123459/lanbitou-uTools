import { computed, ref, watch } from 'vue'
import { useAssistantStore } from '../stores/assistantStore'

export const WRITING_DAILY_GOAL_KEY = 'lanbitou/writing-daily-goal'
export const DEFAULT_DAILY_GOAL = 500
const LINE_CHART_DAYS = 30
const HEATMAP_WEEK_COUNT = 53

export function getNoteCharCount(note) {
  const text = note?.markdownContent || note?.text || note?.rawContent || note?.summary || ''
  return text.replace(/\s/g, '').length
}

export function toDateKey(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(key) {
  return new Date(`${key}T00:00:00`)
}

export function startOfWeek(date) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

export function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function formatDisplayDate(key) {
  const date = parseDateKey(key)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatShortDate(key) {
  const date = parseDateKey(key)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function readDailyGoal() {
  try {
    const raw = localStorage.getItem(WRITING_DAILY_GOAL_KEY)
    const value = Number.parseInt(raw ?? '', 10)
    if (Number.isFinite(value) && value > 0) return value
  } catch {
    // ignore
  }
  return DEFAULT_DAILY_GOAL
}

function writeDailyGoal(value) {
  try {
    localStorage.setItem(WRITING_DAILY_GOAL_KEY, String(value))
  } catch {
    // ignore
  }
}

function levelForWordCount(count) {
  if (!count) return 0
  if (count < 100) return 1
  if (count < 300) return 2
  if (count < 600) return 3
  return 4
}

function levelForFragmentCount(count) {
  if (!count) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

function buildSmoothLinePath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`

  let path = `M ${points[0].x},${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index]
    const current = points[index]
    const next = points[index + 1]
    const after = points[index + 2] || next
    const cp1x = current.x + (next.x - previous.x) / 6
    const cp1y = current.y + (next.y - previous.y) / 6
    const cp2x = next.x - (after.x - current.x) / 6
    const cp2y = next.y - (after.y - current.y) / 6
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`
  }
  return path
}

function buildSmoothAreaPath(points, bottomY) {
  if (!points.length) return ''
  const line = buildSmoothLinePath(points)
  const first = points[0]
  const last = points[points.length - 1]
  return `${line} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`
}

function buildMonthLabelForWeek(week, previousMonth) {
  const firstInRange = week.find((day) => day.inRange)
  if (!firstInRange) return { label: '', month: previousMonth }

  const date = parseDateKey(firstInRange.key)
  const month = date.getMonth()
  if (date.getDate() <= 7 && month !== previousMonth) {
    return { label: `${month + 1}月`, month }
  }
  return { label: '', month: previousMonth ?? month }
}

export function useWritingStats() {
  const assistantStore = useAssistantStore()
  const dailyGoal = ref(readDailyGoal())

  const saveDailyGoal = (value) => {
    const next = Math.max(50, Math.min(99999, Math.round(Number(value) || DEFAULT_DAILY_GOAL)))
    dailyGoal.value = next
    writeDailyGoal(next)
    return next
  }

  const wordsByDate = computed(() => {
    const map = new Map()
    assistantStore.notes.forEach((note) => {
      const key = toDateKey(note.createdAt)
      if (!key) return
      map.set(key, (map.get(key) || 0) + getNoteCharCount(note))
    })
    return map
  })

  const fragmentsByDate = computed(() => {
    const map = new Map()
    assistantStore.notes.forEach((note) => {
      const key = toDateKey(note.createdAt)
      if (!key) return
      map.set(key, (map.get(key) || 0) + 1)
    })
    return map
  })

  const todayKey = computed(() => toDateKey(new Date()))

  const todayWords = computed(() => wordsByDate.value.get(todayKey.value) || 0)

  const goalProgress = computed(() => {
    const goal = dailyGoal.value
    if (!goal) return 0
    return Math.min(100, Math.round((todayWords.value / goal) * 100))
  })

  const goalCompleted = computed(() => todayWords.value >= dailyGoal.value)

  const goalRemainder = computed(() =>
    Math.max(0, dailyGoal.value - todayWords.value),
  )

  const rangeEnd = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })

  const lineChartRangeStart = computed(() => addDays(rangeEnd.value, -(LINE_CHART_DAYS - 1)))

  const heatmapRangeStart = computed(() => {
    const endWeekStart = startOfWeek(rangeEnd.value)
    return addDays(endWeekStart, -(HEATMAP_WEEK_COUNT - 1) * 7)
  })

  const heatmapWeeks = computed(() => {
    const start = heatmapRangeStart.value
    const end = rangeEnd.value
    const cols = []

    for (let weekIndex = 0; weekIndex < HEATMAP_WEEK_COUNT; weekIndex += 1) {
      const weekStart = addDays(start, weekIndex * 7)
      const days = []

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const date = addDays(weekStart, dayIndex)
        const key = toDateKey(date)
        const inRange = date >= start && date <= end
        const fragmentCount = inRange ? fragmentsByDate.value.get(key) || 0 : 0
        days.push({
          key,
          inRange,
          fragmentCount,
          level: levelForFragmentCount(fragmentCount),
          isToday: key === todayKey.value,
          tooltip: inRange
            ? `${formatDisplayDate(key)} · ${fragmentCount} 条碎片`
            : '',
        })
      }

      cols.push(days)
    }

    return cols
  })

  const heatmapMonthLabels = computed(() => {
    const labels = []
    let previousMonth = null

    heatmapWeeks.value.forEach((week) => {
      const { label, month } = buildMonthLabelForWeek(week, previousMonth)
      labels.push(label)
      if (month != null) previousMonth = month
    })

    return labels
  })

  const lineChartDays = computed(() => {
    const items = []
    for (let offset = LINE_CHART_DAYS - 1; offset >= 0; offset -= 1) {
      const date = addDays(rangeEnd.value, -offset)
      const key = toDateKey(date)
      const count = wordsByDate.value.get(key) || 0
      items.push({
        key,
        label: formatShortDate(key),
        count,
        isToday: key === todayKey.value,
        tooltip: `${formatDisplayDate(key)} · ${count} 字`,
      })
    }
    return items
  })

  const lineChartMax = computed(() => {
    let max = 0
    lineChartDays.value.forEach((item) => {
      max = Math.max(max, item.count)
    })
    return max || 1
  })

  const lineChartPoints = computed(() => {
    const width = 640
    const height = 132
    const padX = 8
    const padY = 12
    const innerW = width - padX * 2
    const innerH = height - padY * 2
    const days = lineChartDays.value
    const max = lineChartMax.value

    const points = days.map((day, index) => {
      const x = padX + (days.length <= 1 ? innerW / 2 : (innerW * index) / (days.length - 1))
      const y = padY + innerH - (day.count / max) * innerH
      return { x, y, ...day }
    })

    const bottomY = padY + innerH
    const smoothPath = buildSmoothLinePath(points)
    const smoothArea = buildSmoothAreaPath(points, bottomY)

    return {
      width,
      height,
      padX,
      padY,
      innerW,
      innerH,
      bottomY,
      points,
      smoothPath,
      smoothArea,
    }
  })

  const currentStreak = computed(() => {
    let streak = 0
    let cursor = new Date(rangeEnd.value)

    while (cursor >= heatmapRangeStart.value) {
      const key = toDateKey(cursor)
      if ((fragmentsByDate.value.get(key) || 0) > 0) {
        streak += 1
        cursor = addDays(cursor, -1)
      } else {
        break
      }
    }

    return streak
  })

  const lineChartActiveDays = computed(() => {
    let total = 0
    lineChartDays.value.forEach((day) => {
      if (day.count > 0) total += 1
    })
    return total
  })

  const lineChartTotalWords = computed(() => {
    let total = 0
    lineChartDays.value.forEach((day) => {
      total += day.count
    })
    return total
  })

  watch(dailyGoal, (value) => {
    writeDailyGoal(value)
  })

  return {
    dailyGoal,
    saveDailyGoal,
    todayWords,
    goalProgress,
    goalCompleted,
    goalRemainder,
    heatmapWeeks,
    heatmapMonthLabels,
    heatmapWeekCount: HEATMAP_WEEK_COUNT,
    lineChartDays,
    lineChartPoints,
    currentStreak,
    lineChartActiveDays,
    lineChartTotalWords,
  }
}
