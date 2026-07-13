<template>
  <section class="heatmap-panel">
    <header class="heatmap-header">
      <h2 class="heatmap-title">写作热力图</h2>
      <p class="heatmap-desc">按天统计碎片笔记记录频率</p>
    </header>

    <div class="heatmap-stats">
      <div v-for="item in statItems" :key="item.label" class="heatmap-stat-card">
        <span class="heatmap-stat-value">{{ item.value }}</span>
        <span class="heatmap-stat-label">{{ item.label }}</span>
      </div>
    </div>

    <div class="heatmap-card">
      <div class="heatmap-card-head">
        <span class="heatmap-card-title">近 {{ weeks.length }} 周</span>
        <div class="heatmap-legend" aria-hidden="true">
          <span>少</span>
          <span
            v-for="level in 5"
            :key="level"
            class="heatmap-legend-cell"
            :class="`is-level-${level - 1}`"
          />
          <span>多</span>
        </div>
      </div>

      <div class="heatmap-grid-wrap">
        <div class="heatmap-weekdays" aria-hidden="true">
          <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
        </div>
        <div class="heatmap-grid-scroll">
          <div class="heatmap-grid">
            <div
              v-for="(week, weekIndex) in weeks"
              :key="weekIndex"
              class="heatmap-week-col"
            >
              <button
                v-for="day in week"
                :key="day.key"
                type="button"
                class="heatmap-cell"
                :class="[
                  day.inRange ? `is-level-${day.level}` : 'is-outside',
                  { 'is-today': day.isToday },
                ]"
                :title="day.title"
                :aria-label="day.title"
                :disabled="!day.inRange"
                @click="onDayClick(day)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  computeCurrentWritingStreak,
  useDailyWritingStats,
} from '../../composables/useWritingStats'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open-day'])

const { wordsByDate, fragmentsByDate } = useDailyWritingStats({ active: () => props.active })

const WEEK_COUNT = 20
const weekdayLabels = ['一', '', '三', '', '五', '', '日']

function toDateKey(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(key) {
  return new Date(`${key}T00:00:00`)
}

function startOfWeek(date) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function formatDisplayDate(key) {
  const date = parseDateKey(key)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const countByDate = computed(() => fragmentsByDate.value)

const onDayClick = (day) => {
  if (!day.inRange) return
  emit('open-day', day.key)
}

const rangeStart = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endWeekStart = startOfWeek(today)
  return addDays(endWeekStart, -(WEEK_COUNT - 1) * 7)
})

const rangeEnd = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
})

const todayKey = computed(() => toDateKey(new Date()))

const levelForCount = (count) => {
  if (!count) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

const weeks = computed(() => {
  const start = rangeStart.value
  const end = rangeEnd.value
  const cols = []

  for (let weekIndex = 0; weekIndex < WEEK_COUNT; weekIndex += 1) {
    const weekStart = addDays(start, weekIndex * 7)
    const days = []

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(weekStart, dayIndex)
      const key = toDateKey(date)
      const inRange = date >= start && date <= end
      const count = inRange ? countByDate.value.get(key) || 0 : 0
      days.push({
        key,
        inRange,
        count,
        level: levelForCount(count),
        isToday: key === todayKey.value,
        title: inRange
          ? `${formatDisplayDate(key)}：${count} 条笔记`
          : '',
      })
    }

    cols.push(days)
  }

  return cols
})

const activeDays = computed(() => {
  let total = 0
  countByDate.value.forEach((count, key) => {
    const date = parseDateKey(key)
    if (date >= rangeStart.value && date <= rangeEnd.value && count > 0) {
      total += 1
    }
  })
  return total
})

const totalNotes = computed(() => {
  let total = 0
  countByDate.value.forEach((count, key) => {
    const date = parseDateKey(key)
    if (date >= rangeStart.value && date <= rangeEnd.value) {
      total += count
    }
  })
  return total
})

const maxDailyCount = computed(() => {
  let max = 0
  countByDate.value.forEach((count, key) => {
    const date = parseDateKey(key)
    if (date >= rangeStart.value && date <= rangeEnd.value) {
      max = Math.max(max, count)
    }
  })
  return max
})

const currentStreak = computed(() =>
  computeCurrentWritingStreak(wordsByDate.value, rangeStart.value, rangeEnd.value),
)

const statItems = computed(() => [
  { label: '总笔记', value: totalNotes.value },
  { label: '活跃天数', value: activeDays.value },
  { label: '当前连续', value: `${currentStreak.value} 天` },
  { label: '单日最多', value: maxDailyCount.value },
])
</script>

<style scoped>
.heatmap-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: var(--frame-inner-width);
  padding-top: 22px;
  gap: 20px;
}

.heatmap-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heatmap-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary);
}

.heatmap-desc {
  margin: 0;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.heatmap-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.heatmap-stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.heatmap-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.heatmap-stat-label {
  font-size: 12px;
  color: var(--color-secondary-text);
}

.heatmap-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.heatmap-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.heatmap-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.heatmap-legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-secondary-text);
}

.heatmap-legend-cell,
.heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.heatmap-legend-cell.is-level-0,
.heatmap-cell.is-level-0 {
  background: rgba(24, 24, 27, 0.06);
}

.heatmap-legend-cell.is-level-1,
.heatmap-cell.is-level-1 {
  background: rgba(37, 99, 235, 0.18);
}

.heatmap-legend-cell.is-level-2,
.heatmap-cell.is-level-2 {
  background: rgba(37, 99, 235, 0.34);
}

.heatmap-legend-cell.is-level-3,
.heatmap-cell.is-level-3 {
  background: rgba(37, 99, 235, 0.52);
}

.heatmap-legend-cell.is-level-4,
.heatmap-cell.is-level-4 {
  background: rgba(37, 99, 235, 0.78);
}

.heatmap-grid-wrap {
  display: flex;
  gap: 8px;
  min-height: 0;
}

.heatmap-weekdays {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  gap: 3px;
  padding-top: 0;
  font-size: 10px;
  line-height: 12px;
  color: var(--color-secondary-text);
}

.heatmap-grid-scroll {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 4px;
}

.heatmap-grid {
  display: flex;
  gap: 3px;
  width: max-content;
}

.heatmap-week-col {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  gap: 3px;
}

.heatmap-cell {
  border: 0;
  padding: 0;
  cursor: pointer;
}

.heatmap-cell.is-outside {
  opacity: 0;
  pointer-events: none;
}

.heatmap-cell.is-today {
  outline: 1px solid rgba(37, 99, 235, 0.55);
  outline-offset: 1px;
}

.heatmap-cell:not(:disabled):hover {
  transform: scale(1.08);
}

@media (max-width: 720px) {
  .heatmap-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
