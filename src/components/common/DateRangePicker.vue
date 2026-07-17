<template>
  <div ref="rootRef" class="date-range-picker" :class="{ 'is-compact': compact }">
    <div class="date-range-trigger-wrap">
      <button
        type="button"
        class="date-range-trigger"
        :class="{ 'has-value': hasValue, 'is-open': open }"
        :aria-label="compact ? triggerLabel : undefined"
        :title="compact ? triggerLabel : undefined"
        @click="toggleOpen"
      >
        <svg
          class="date-range-trigger-icon"
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2.5" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span v-if="!compact" class="date-range-trigger-text">{{ triggerLabel }}</span>
      </button>
      <button
        v-if="!compact && hasValue"
        type="button"
        class="date-range-clear"
        aria-label="清除日期"
        @click="clearRange"
      >
        ×
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="date-range-panel"
        :class="{ 'is-panel-compact': panelCompact }"
        :style="panelStyle"
      >
        <div class="date-range-panel-head">
          <button type="button" class="date-range-nav" aria-label="上一月" @click="shiftMonth(-1)">
            ‹
          </button>
          <div class="date-range-month-labels">
            <span>{{ monthLabel(viewMonth) }}</span>
            <span v-if="!panelCompact">{{ monthLabel(viewMonth + 1) }}</span>
          </div>
          <button type="button" class="date-range-nav" aria-label="下一月" @click="shiftMonth(1)">
            ›
          </button>
        </div>

        <div class="date-range-calendars" :class="{ 'is-single': panelCompact }">
          <div
            v-for="offset in panelCompact ? [0] : [0, 1]"
            :key="offset"
            class="date-range-calendar"
          >
            <div class="date-range-weekdays">
              <span v-for="day in weekDays" :key="day">{{ day }}</span>
            </div>
            <div class="date-range-days">
              <button
                v-for="cell in buildMonthCells(viewMonth + offset)"
                :key="`${offset}-${cell.dateStr}`"
                type="button"
                class="date-range-day"
                :class="dayClass(cell)"
                :disabled="!cell.inMonth"
                @click="onDayClick(cell.dateStr)"
                @mouseenter="hoverDate = cell.dateStr"
                @mouseleave="hoverDate = ''"
              >
                {{ cell.day }}
              </button>
            </div>
          </div>
        </div>

        <p class="date-range-hint">点击选择起始日，再点击选择结束日</p>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  dateFrom: {
    type: String,
    default: '',
  },
  dateTo: {
    type: String,
    default: '',
  },
  compact: {
    type: Boolean,
    default: false,
  },
  panelCompact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:dateFrom', 'update:dateTo'])

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const rootRef = ref(null)
const panelRef = ref(null)
const open = ref(false)
const viewMonth = ref(monthIndex(new Date()))
const hoverDate = ref('')
const panelStyle = ref({ top: '0px', left: '0px' })

const hasValue = computed(() => Boolean(props.dateFrom || props.dateTo))

const triggerLabel = computed(() => {
  if (props.dateFrom && props.dateTo) {
    return `${props.dateFrom} ~ ${props.dateTo}`
  }
  if (props.dateFrom) return `${props.dateFrom} ~ …`
  return '选择日期范围'
})

function monthIndex(date) {
  return date.getFullYear() * 12 + date.getMonth()
}

function indexToDate(index) {
  return new Date(Math.floor(index / 12), index % 12, 1)
}

function monthLabel(index) {
  const date = indexToDate(index)
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

function formatDateParam(date) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDate(str) {
  if (!str) return null
  const date = new Date(`${str}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildMonthCells(index) {
  const first = indexToDate(index)
  const year = first.getFullYear()
  const month = first.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = formatDateParam(new Date())
  const cells = []

  for (let i = 0; i < 42; i += 1) {
    const dayNum = i - firstWeekday + 1
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth
    const date = inMonth ? new Date(year, month, dayNum) : new Date(year, month, 1)
    const dateStr = inMonth ? formatDateParam(date) : `pad-${i}`
    cells.push({
      day: inMonth ? dayNum : '',
      dateStr: inMonth ? dateStr : '',
      inMonth,
      isToday: inMonth && dateStr === todayStr,
    })
  }
  return cells
}

function isBetween(dateStr, start, end) {
  if (!start || !end || !dateStr) return false
  return dateStr >= start && dateStr <= end
}

function dayClass(cell) {
  if (!cell.inMonth) return 'is-outside'
  const from = props.dateFrom
  const to =
    props.dateTo ||
    (props.dateFrom && !props.dateTo && hoverDate.value ? hoverDate.value : '')
  const start = from && to && to < from ? to : from
  const end = from && to && to < from ? from : to
  const inRange = isBetween(cell.dateStr, start, end)
  const isStart = cell.dateStr === start
  const isEnd = cell.dateStr === end
  return {
    'is-today': cell.isToday,
    'is-range': inRange && start && end,
    'is-start': isStart,
    'is-end': isEnd,
  }
}

const updatePanelPosition = async () => {
  await nextTick()
  const trigger = rootRef.value
  const panel = panelRef.value
  if (!trigger || !panel) return

  const rect = trigger.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const padding = 8
  let left = rect.left
  let top = rect.bottom + 8

  if (left + panelRect.width > window.innerWidth - padding) {
    left = Math.max(padding, window.innerWidth - panelRect.width - padding)
  }
  if (top + panelRect.height > window.innerHeight - padding) {
    top = Math.max(padding, rect.top - panelRect.height - 8)
  }

  panelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

const toggleOpen = async () => {
  open.value = !open.value
  if (open.value) {
    const anchor = parseDate(props.dateFrom) || new Date()
    viewMonth.value = monthIndex(anchor)
    await updatePanelPosition()
  }
}

const shiftMonth = (delta) => {
  viewMonth.value += delta
}

const onDayClick = (dateStr) => {
  if (!dateStr) return
  if (!props.dateFrom || (props.dateFrom && props.dateTo)) {
    emit('update:dateFrom', dateStr)
    emit('update:dateTo', '')
    return
  }
  if (dateStr < props.dateFrom) {
    emit('update:dateTo', props.dateFrom)
    emit('update:dateFrom', dateStr)
  } else {
    emit('update:dateTo', dateStr)
  }
  open.value = false
}

const clearRange = () => {
  emit('update:dateFrom', '')
  emit('update:dateTo', '')
  open.value = false
}

const onDocumentPointerDown = (event) => {
  if (!open.value) return
  const root = rootRef.value
  const panel = panelRef.value
  if (root?.contains(event.target) || panel?.contains(event.target)) return
  open.value = false
}

watch(open, (visible) => {
  if (visible) {
    document.addEventListener('pointerdown', onDocumentPointerDown)
    window.addEventListener('resize', updatePanelPosition)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown)
    window.removeEventListener('resize', updatePanelPosition)
    hoverDate.value = ''
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', updatePanelPosition)
})
</script>

<style scoped>
.date-range-picker.is-compact {
  flex: 0 0 auto;
  min-width: 0;
  width: auto;
}

.date-range-picker.is-compact .date-range-trigger-wrap {
  width: auto;
}

.date-range-picker.is-compact .date-range-trigger {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-secondary-text);
}

.date-range-picker.is-compact .date-range-trigger.has-value,
.date-range-picker.is-compact .date-range-trigger.is-open {
  background: transparent;
  color: var(--color-secondary-text);
}

.date-range-picker.is-compact .date-range-trigger:hover {
  background: transparent;
  color: var(--color-text);
}

.date-range-picker.is-compact .date-range-trigger:focus-visible {
  box-shadow: none;
  color: var(--color-accent);
}

.date-range-picker {
  position: relative;
  flex: 1 1 220px;
  min-width: 180px;
}

.date-range-trigger-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.date-range-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--btn-radius);
  background: var(--color-surface);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  box-sizing: border-box;
}

.date-range-trigger.has-value,
.date-range-trigger.is-open {
  color: var(--color-text);
  border-color: rgba(24, 24, 27, 0.28);
}

.date-range-trigger:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.date-range-trigger-icon {
  flex: 0 0 auto;
  color: var(--color-secondary-text);
}

.date-range-trigger-text {
  flex: 1;
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-range-clear {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.date-range-clear:hover {
  background: rgba(24, 24, 27, 0.12);
  color: var(--color-primary);
}

.date-range-panel {
  position: fixed;
  z-index: 220;
  width: min(560px, calc(100vw - 16px));
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-float, 0 16px 40px rgba(24, 24, 27, 0.12));
}

.date-range-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.date-range-month-labels {
  display: flex;
  flex: 1;
  justify-content: space-around;
  gap: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.date-range-nav {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-primary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.date-range-nav:hover {
  background: rgba(24, 24, 27, 0.1);
}

.date-range-calendars {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.date-range-weekdays,
.date-range-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.date-range-weekdays {
  margin-bottom: 4px;
}

.date-range-weekdays span {
  text-align: center;
  font-size: 11px;
  color: var(--color-secondary-text);
  line-height: 1.8;
}

.date-range-day {
  position: relative;
  height: 32px;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border-radius: 8px;
}

.date-range-day.is-outside {
  visibility: hidden;
  pointer-events: none;
}

.date-range-day.is-today {
  font-weight: 700;
  color: var(--color-accent);
}

.date-range-day.is-range {
  background: rgba(24, 24, 27, 0.06);
  border-radius: 0;
}

.date-range-day.is-start,
.date-range-day.is-end {
  background: #18181b;
  color: #fff;
  font-weight: 600;
  border-radius: 8px;
  z-index: 1;
}

.date-range-day.is-start.is-end {
  border-radius: 8px;
}

.date-range-day:hover:not(.is-start):not(.is-end):not(.is-outside) {
  background: rgba(24, 24, 27, 0.08);
}

.date-range-hint {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--color-secondary-text);
  text-align: center;
}

.date-range-panel.is-panel-compact {
  width: min(280px, calc(100vw - 16px));
  padding: 10px;
}

.date-range-panel.is-panel-compact .date-range-panel-head {
  margin-bottom: 8px;
}

.date-range-panel.is-panel-compact .date-range-month-labels {
  font-size: 12px;
}

.date-range-panel.is-panel-compact .date-range-nav {
  width: 26px;
  height: 26px;
  font-size: 16px;
}

.date-range-panel.is-panel-compact .date-range-day {
  height: 28px;
  font-size: 11px;
  border-radius: 6px;
}

.date-range-panel.is-panel-compact .date-range-hint {
  margin-top: 8px;
  font-size: 10px;
}

.date-range-calendars.is-single {
  grid-template-columns: 1fr;
}

@media (max-width: 640px) {
  .date-range-calendars {
    grid-template-columns: 1fr;
  }

  .date-range-month-labels span:last-child {
    display: none;
  }
}
</style>
