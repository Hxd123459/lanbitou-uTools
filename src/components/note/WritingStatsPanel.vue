<template>
  <section class="writing-stats-panel" aria-label="写作统计">
    <div class="writing-stats-kpis">
      <article class="writing-stats-kpi writing-stats-kpi--today">
        <span class="writing-stats-kpi-label">今日字数</span>
        <span class="writing-stats-kpi-value">{{ todayWords }}</span>
        <span class="writing-stats-kpi-hint">字</span>
      </article>

      <article class="writing-stats-kpi writing-stats-kpi--goal">
        <span class="writing-stats-kpi-label">写作目标</span>
        <div class="writing-stats-goal-row">
          <span class="writing-stats-kpi-value">{{ todayWords }}</span>
          <span class="writing-stats-goal-sep">/</span>
          <label
            class="writing-stats-goal-input-shell"
            :class="{ 'is-compact': goalInputText.length >= 5 }"
          >
            <span class="sr-only">每日目标字数</span>
            <span class="writing-stats-goal-input-mirror" aria-hidden="true">{{ goalInputText || '0' }}</span>
            <input
              :value="goalInputText"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="5"
              class="writing-stats-goal-input"
              @input="onGoalInput"
              @change="commitGoal"
              @keydown.enter="commitGoal"
              @blur="commitGoal"
            />
          </label>
          <span class="writing-stats-kpi-hint">字</span>
        </div>
        <div class="writing-stats-goal-bar" aria-hidden="true">
          <motion.span
            v-if="enterAnimationEnabled"
            :key="`goal-bar-${enterSeed}`"
            class="writing-stats-goal-bar-fill"
            :class="{ 'is-complete': goalCompleted }"
            :initial="{ width: '0%' }"
            :animate="{ width: `${goalProgress}%` }"
            :transition="goalBarTransition"
          />
          <span
            v-else
            class="writing-stats-goal-bar-fill"
            :class="{ 'is-complete': goalCompleted }"
            :style="{ width: `${goalProgress}%` }"
          />
        </div>
        <span
          class="writing-stats-goal-status"
          :class="{ 'is-complete': goalCompleted }"
        >
          {{ goalCompleted ? '今日目标已完成' : `还差 ${goalRemainder} 字` }}
        </span>
      </article>

      <article
        class="writing-stats-kpi writing-stats-kpi--streak"
        :class="streakTier ? `is-streak-${streakTier}` : null"
      >
        <div class="writing-stats-streak-head">
          <span class="writing-stats-kpi-label">连续写作</span>
          <motion.span
            v-if="streakBadge"
            :key="`streak-badge-${streakTier}`"
            class="writing-stats-streak-badge"
            :initial="reduced ? false : { opacity: 0, y: -4, scale: 0.92 }"
            :animate="{ opacity: 1, y: 0, scale: 1 }"
            :transition="streakBadgeTransition"
          >
            {{ streakBadge }}
          </motion.span>
        </div>
        <motion.span
          :key="`streak-val-${streakTier}-${displayStreak}`"
          class="writing-stats-kpi-value writing-stats-streak-value"
          :animate="streakPulseMotion"
          :transition="streakPulseTransition"
        >
          {{ displayStreak }}
        </motion.span>
        <span class="writing-stats-kpi-hint">天</span>
      </article>
    </div>

    <section class="writing-stats-card">
      <div class="writing-stats-card-head">
        <h3 class="writing-stats-card-title">近 30 日字数趋势</h3>
        <span class="writing-stats-card-meta">
          活跃 {{ lineChartActiveDays }} 天 · 累计 {{ lineChartTotalWords }} 字
        </span>
      </div>
      <div
        ref="chartWrapRef"
        class="writing-stats-chart-wrap"
        @mousemove="onChartMouseMove"
        @mouseleave="hideTooltip"
      >
        <svg
          class="writing-stats-line-chart"
          :viewBox="`0 0 ${lineChartPoints.width} ${lineChartPoints.height}`"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="writing-stats-area-panel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(37, 99, 235, 0.22)" />
              <stop offset="100%" stop-color="rgba(37, 99, 235, 0.02)" />
            </linearGradient>
            <clipPath :id="chartClipId">
              <motion.rect
                v-if="enterAnimationEnabled"
                :key="`chart-clip-${enterSeed}`"
                x="0"
                y="0"
                :height="lineChartPoints.height"
                :initial="chartClipInitial"
                :animate="{ width: lineChartPoints.width }"
                :transition="chartRevealTransition"
              />
              <rect
                v-else
                x="0"
                y="0"
                :width="lineChartPoints.width"
                :height="lineChartPoints.height"
              />
            </clipPath>
          </defs>
          <motion.g
            v-if="lineChartPoints.smoothPath && enterAnimationEnabled"
            :key="`chart-series-${enterSeed}`"
            :clip-path="`url(#${chartClipId})`"
            :initial="chartAreaInitial"
            :animate="{ opacity: 1 }"
            :transition="chartAreaTransition"
          >
            <path
              v-if="lineChartPoints.smoothArea"
              class="writing-stats-line-area"
              :d="lineChartPoints.smoothArea"
              fill="url(#writing-stats-area-panel)"
            />
            <path
              class="writing-stats-line-path"
              :d="lineChartPoints.smoothPath"
              fill="none"
            />
          </motion.g>
          <g
            v-else-if="lineChartPoints.smoothPath"
            :clip-path="`url(#${chartClipId})`"
          >
            <path
              v-if="lineChartPoints.smoothArea"
              class="writing-stats-line-area"
              :d="lineChartPoints.smoothArea"
              fill="url(#writing-stats-area-panel)"
            />
            <path
              class="writing-stats-line-path"
              :d="lineChartPoints.smoothPath"
              fill="none"
            />
          </g>
          <circle
            v-for="point in lineChartPoints.points"
            :key="point.key"
            class="writing-stats-line-hit"
            :class="{ 'is-active': hoveredChartKey === point.key }"
            :cx="point.x"
            :cy="point.y"
            r="8"
            @mouseenter="showChartTooltip(point, $event)"
          />
          <circle
            v-if="activeChartPoint"
            class="writing-stats-line-dot"
            :cx="activeChartPoint.x"
            :cy="activeChartPoint.y"
            r="4"
          />
        </svg>
        <div class="writing-stats-chart-labels" aria-hidden="true">
          <span>{{ lineChartDays[0]?.label }}</span>
          <span>{{ lineChartDays[Math.floor(lineChartDays.length / 2)]?.label }}</span>
          <span>{{ lineChartDays[lineChartDays.length - 1]?.label }}</span>
        </div>
      </div>
    </section>

    <section class="writing-stats-card">
      <div class="writing-stats-card-head">
        <h3 class="writing-stats-card-title">近一年写作热力图</h3>
        <div class="writing-stats-legend" aria-hidden="true">
          <span>少</span>
          <span
            v-for="level in 5"
            :key="level"
            class="writing-stats-legend-cell"
            :class="`is-level-${level - 1}`"
          />
          <span>多</span>
        </div>
      </div>
      <div class="writing-stats-heatmap-wrap">
        <div class="writing-stats-weekdays" aria-hidden="true">
          <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
        </div>
        <div class="writing-stats-heatmap-scroll">
          <div class="writing-stats-heatmap-months" aria-hidden="true">
            <span
              v-for="(label, weekIndex) in heatmapMonthLabels"
              :key="`month-${weekIndex}`"
              class="writing-stats-month-label"
            >
              {{ label }}
            </span>
          </div>
          <div class="writing-stats-heatmap-grid">
            <div
              v-for="(week, weekIndex) in heatmapWeeks"
              :key="weekIndex"
              class="writing-stats-week-col"
            >
              <button
                v-for="day in week"
                :key="day.key"
                type="button"
                class="writing-stats-cell"
                :class="[
                  day.inRange ? `is-level-${day.level}` : 'is-outside',
                  { 'is-today': day.isToday },
                ]"
                :aria-label="day.tooltip"
                :disabled="!day.inRange"
                @mouseenter="showHeatmapTooltip(day, $event)"
                @mouseleave="hideTooltip"
                @click="onHeatmapDayClick(day)"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <motion.div
        v-if="tooltip.visible"
        ref="tooltipRef"
        class="writing-stats-tooltip"
        :style="tooltipStyle"
        :initial="reduced ? false : { opacity: 0 }"
        :animate="{ opacity: 1 }"
        :transition="tooltipTransition"
      >
        {{ tooltip.text }}
      </motion.div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useWritingStats } from '../../composables/useWritingStats'

const STREAK_WARM_DAYS = 7
const STREAK_SILVER_DAYS = 14
const STREAK_GOLD_DAYS = 30
const STREAK_LEGEND_DAYS = 100
const TOOLTIP_OFFSET_Y = 46
const TOOLTIP_EDGE_PADDING = 8

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open-day'])

const { reduced } = useMotionPresets()

const {
  dailyGoal,
  saveDailyGoal,
  todayWords,
  goalProgress,
  goalCompleted,
  goalRemainder,
  heatmapWeeks,
  heatmapMonthLabels,
  lineChartDays,
  lineChartPoints,
  currentStreak,
  lineChartActiveDays,
  lineChartTotalWords,
} = useWritingStats({ active: () => props.active })

const goalInputText = ref(String(dailyGoal.value))
const weekdayLabels = ['一', '', '三', '', '五', '', '日']
const chartWrapRef = ref(null)
const tooltipRef = ref(null)
const hoveredChartKey = ref('')
const tooltip = ref({
  visible: false,
  text: '',
  anchorX: 0,
  anchorY: 0,
})
const tooltipSize = ref({ width: 0, height: 0 })
const enterSeed = ref(0)
const enterAnimationEnabled = ref(true)
const hasPlayedEnterAnimation = ref(false)

watch(
  () => props.active,
  (isActive) => {
    if (!isActive || hasPlayedEnterAnimation.value) return
    enterSeed.value += 1
    hasPlayedEnterAnimation.value = true
    if (reduced.value) {
      enterAnimationEnabled.value = false
      return
    }
    window.setTimeout(() => {
      enterAnimationEnabled.value = false
    }, 1300)
  },
  { immediate: true },
)

const chartClipId = computed(() =>
  enterAnimationEnabled.value
    ? `writing-stats-chart-clip-${enterSeed.value}`
    : 'writing-stats-chart-clip-static',
)

const displayStreak = computed(() => currentStreak.value)

const streakTier = computed(() => {
  const days = displayStreak.value
  if (days >= STREAK_LEGEND_DAYS) return 'legend'
  if (days >= STREAK_GOLD_DAYS) return 'gold'
  if (days >= STREAK_SILVER_DAYS) return 'silver'
  if (days >= STREAK_WARM_DAYS) return 'warm'
  return ''
})

const streakBadge = computed(() => {
  const days = displayStreak.value
  if (days >= STREAK_LEGEND_DAYS) return '百日连写'
  if (days >= STREAK_GOLD_DAYS) return '三十日不间断'
  if (days >= STREAK_SILVER_DAYS) return '双周挑战达成'
  if (days >= STREAK_WARM_DAYS) return '一周连写'
  return ''
})

const streakPulseMotion = computed(() => {
  if (reduced.value || !streakTier.value) return {}
  if (streakTier.value === 'legend') return { scale: [1, 1.06, 1] }
  if (streakTier.value === 'gold') return { scale: [1, 1.045, 1] }
  return { scale: [1, 1.03, 1] }
})

const streakPulseTransition = computed(() =>
  reduced.value || !streakTier.value
    ? { duration: 0 }
    : {
        duration: streakTier.value === 'legend' ? 1.8 : 2.4,
        repeat: Infinity,
        ease: 'easeInOut',
      },
)

const goalBarTransition = computed(() =>
  reduced.value
    ? { duration: 0 }
    : { type: 'spring', bounce: 0.1, duration: 0.9, delay: 0.08 },
)

const chartClipInitial = computed(() => (reduced.value ? false : { width: 0 }))

const chartAreaInitial = computed(() => (reduced.value ? false : { opacity: 0 }))

const chartRevealTransition = computed(() =>
  reduced.value
    ? { duration: 0 }
    : { duration: 1.15, ease: [0.22, 1, 0.36, 1], delay: 0.06 },
)

const chartAreaTransition = computed(() =>
  reduced.value
    ? { duration: 0 }
    : { duration: 0.75, ease: 'easeOut', delay: 0.42 },
)

const streakBadgeTransition = computed(() =>
  reduced.value
    ? { duration: 0 }
    : { type: 'spring', bounce: 0.28, duration: 0.55, delay: 0.18 },
)

const tooltipTransition = computed(() =>
  reduced.value ? { duration: 0 } : { duration: 0.14, ease: 'easeOut' },
)

const activeChartPoint = computed(() =>
  lineChartPoints.value.points.find((point) => point.key === hoveredChartKey.value) ?? null,
)

const onGoalInput = (event) => {
  const digits = String(event.target.value ?? '').replace(/\D/g, '').slice(0, 5)
  goalInputText.value = digits
  event.target.value = digits
}

const commitGoal = () => {
  const parsed = Number.parseInt(goalInputText.value, 10)
  const saved = saveDailyGoal(Number.isFinite(parsed) ? parsed : dailyGoal.value)
  goalInputText.value = String(saved)
}

const tooltipStyle = computed(() => {
  const { anchorX, anchorY } = tooltip.value
  const { width } = tooltipSize.value
  const pad = TOOLTIP_EDGE_PADDING
  const half = width / 2

  let left = anchorX
  let transform = 'translateX(-50%)'

  if (width > 0) {
    if (anchorX + half > window.innerWidth - pad) {
      left = Math.min(anchorX, window.innerWidth - pad)
      transform = 'translateX(-100%)'
    } else if (anchorX - half < pad) {
      left = Math.max(anchorX, pad)
      transform = 'translateX(0)'
    }
  }

  return {
    left: `${left}px`,
    top: `${anchorY}px`,
    transform,
  }
})

const measureTooltip = () => {
  const el = tooltipRef.value
  if (!el) return
  tooltipSize.value = {
    width: el.offsetWidth,
    height: el.offsetHeight,
  }
}

const positionTooltip = (event) => {
  tooltip.value.anchorX = event.clientX
  tooltip.value.anchorY = event.clientY - TOOLTIP_OFFSET_Y
  measureTooltip()
}

const showTooltipAt = (text, event) => {
  if (!text) return
  tooltip.value = {
    visible: true,
    text,
    anchorX: event.clientX,
    anchorY: event.clientY - TOOLTIP_OFFSET_Y,
  }
  void nextTick(measureTooltip)
}

const hideTooltip = () => {
  tooltip.value.visible = false
  hoveredChartKey.value = ''
}

const showChartTooltip = (point, event) => {
  hoveredChartKey.value = point.key
  showTooltipAt(point.tooltip, event)
}

const showHeatmapTooltip = (day, event) => {
  if (!day.inRange) return
  showTooltipAt(day.tooltip, event)
}

const onChartMouseMove = (event) => {
  const wrap = chartWrapRef.value
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const { points, width } = lineChartPoints.value
  if (!points.length) return
  const targetX = ratio * width
  let nearest = points[0]
  let minDist = Math.abs(points[0].x - targetX)
  for (const point of points) {
    const dist = Math.abs(point.x - targetX)
    if (dist < minDist) {
      minDist = dist
      nearest = point
    }
  }
  hoveredChartKey.value = nearest.key
  tooltip.value.visible = true
  tooltip.value.text = nearest.tooltip
  positionTooltip(event)
}

const onHeatmapDayClick = (day) => {
  if (!day.inRange) return
  hideTooltip()
  emit('open-day', day.key)
}

watch(
  () => tooltip.value.text,
  () => {
    if (!tooltip.value.visible) return
    void nextTick(measureTooltip)
  },
)

watch(dailyGoal, (value) => {
  goalInputText.value = String(value)
})
</script>

<style scoped>
.writing-stats-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: var(--frame-inner-width);
  padding: 8px 4px 28px;
  gap: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  container-type: inline-size;
  container-name: writing-stats;
}

.writing-stats-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
}

.writing-stats-kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.writing-stats-kpi--today {
  border-color: rgba(37, 99, 235, 0.18);
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.05) 0%, var(--color-surface) 100%);
}

.writing-stats-kpi-label {
  font-size: 12px;
  color: var(--color-secondary-text);
}

.writing-stats-kpi-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.writing-stats-kpi-hint {
  font-size: 12px;
  color: var(--color-secondary-text);
}

.writing-stats-goal-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-wrap: nowrap;
  min-width: 0;
}

.writing-stats-goal-sep {
  font-size: 18px;
  color: #a1a1aa;
  font-weight: 500;
}

.writing-stats-goal-input-shell {
  position: relative;
  display: inline-grid;
  align-items: baseline;
  min-width: 1.5ch;
  max-width: min(9ch, 100%);
}

.writing-stats-goal-input-shell > * {
  grid-area: 1 / 1;
}

.writing-stats-goal-input-mirror {
  visibility: hidden;
  white-space: pre;
  min-width: 1.5ch;
  padding: 0 2px 2px;
  font: inherit;
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.writing-stats-goal-input-shell.is-compact .writing-stats-goal-input,
.writing-stats-goal-input-shell.is-compact .writing-stats-goal-input-mirror {
  font-size: 22px;
}

.writing-stats-goal-input {
  width: 100%;
  min-width: 0;
  border: 0;
  border-bottom: 1px dashed rgba(24, 24, 27, 0.18);
  background: transparent;
  padding: 0 2px 2px;
  font: inherit;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  outline: none;
}

.writing-stats-goal-input:focus {
  border-bottom-color: var(--color-accent);
}

.writing-stats-goal-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.06);
  overflow: hidden;
}

.writing-stats-goal-bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(37, 99, 235, 0.55);
  width: 0;
}

.writing-stats-goal-bar-fill.is-complete {
  background: var(--color-success);
}

.writing-stats-goal-status {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-secondary-text);
}

.writing-stats-goal-status.is-complete {
  color: var(--color-success);
}

.writing-stats-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.writing-stats-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 12px;
  flex-wrap: nowrap;
  min-width: 0;
}

.writing-stats-card-title {
  margin: 0;
  flex: 0 1 auto;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
}

.writing-stats-card-meta {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--color-secondary-text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.writing-stats-chart-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: crosshair;
}

.writing-stats-line-chart {
  width: 100%;
  height: 132px;
  display: block;
}

.writing-stats-kpi--streak {
  position: relative;
  overflow: hidden;
}

.writing-stats-streak-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.writing-stats-streak-head .writing-stats-kpi-label {
  flex: 1;
  min-width: 0;
}

.writing-stats-kpi--streak.is-streak-warm {
  border-color: rgba(245, 158, 11, 0.28);
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.06) 0%, var(--color-surface) 100%);
}

.writing-stats-kpi--streak.is-streak-silver {
  border-color: rgba(37, 99, 235, 0.28);
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.07) 0%, var(--color-surface) 100%);
  box-shadow: var(--shadow-card), 0 0 0 1px rgba(37, 99, 235, 0.06);
}

.writing-stats-kpi--streak.is-streak-gold {
  border-color: rgba(234, 179, 8, 0.34);
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(37, 99, 235, 0.04) 100%);
  box-shadow: var(--shadow-card), 0 0 18px rgba(234, 179, 8, 0.12);
}

.writing-stats-kpi--streak.is-streak-legend {
  border-color: rgba(124, 58, 237, 0.34);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(37, 99, 235, 0.06) 50%, rgba(234, 179, 8, 0.08) 100%);
  box-shadow: var(--shadow-card), 0 0 22px rgba(124, 58, 237, 0.14);
}

.writing-stats-kpi--streak.is-streak-legend::after {
  content: '';
  position: absolute;
  inset: -40% auto -40% -30%;
  width: 42%;
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(255, 255, 255, 0.42) 48%,
    transparent 100%
  );
  transform: skewX(-18deg);
  animation: writing-stats-streak-shimmer 3.6s ease-in-out infinite;
  pointer-events: none;
}

.writing-stats-streak-value {
  display: inline-block;
  transform-origin: left center;
}

.writing-stats-kpi--streak.is-streak-warm .writing-stats-streak-value {
  color: #b45309;
}

.writing-stats-kpi--streak.is-streak-silver .writing-stats-streak-value {
  color: var(--color-accent);
}

.writing-stats-kpi--streak.is-streak-gold .writing-stats-streak-value {
  color: #a16207;
}

.writing-stats-kpi--streak.is-streak-legend .writing-stats-streak-value {
  background: linear-gradient(120deg, #7c3aed 0%, #2563eb 52%, #ca8a04 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.writing-stats-streak-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.02em;
  max-width: 58%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.writing-stats-kpi--streak.is-streak-warm .writing-stats-streak-badge {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.writing-stats-kpi--streak.is-streak-silver .writing-stats-streak-badge {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

.writing-stats-kpi--streak.is-streak-gold .writing-stats-streak-badge {
  background: rgba(234, 179, 8, 0.14);
  color: #a16207;
}

.writing-stats-kpi--streak.is-streak-legend .writing-stats-streak-badge {
  background: rgba(124, 58, 237, 0.12);
  color: #6d28d9;
}

.writing-stats-line-path {
  stroke: var(--color-accent);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.writing-stats-line-hit {
  fill: transparent;
  stroke: transparent;
  pointer-events: all;
}

.writing-stats-line-dot {
  fill: var(--color-accent);
  stroke: var(--color-surface);
  stroke-width: 2;
  pointer-events: none;
}

.writing-stats-chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-secondary-text);
  font-variant-numeric: tabular-nums;
}

.writing-stats-legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--color-secondary-text);
  white-space: nowrap;
}

.writing-stats-legend-cell,
.writing-stats-cell {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.writing-stats-legend-cell.is-level-0,
.writing-stats-cell.is-level-0 {
  background: rgba(24, 24, 27, 0.06);
}

.writing-stats-legend-cell.is-level-1,
.writing-stats-cell.is-level-1 {
  background: rgba(37, 99, 235, 0.18);
}

.writing-stats-legend-cell.is-level-2,
.writing-stats-cell.is-level-2 {
  background: rgba(37, 99, 235, 0.34);
}

.writing-stats-legend-cell.is-level-3,
.writing-stats-cell.is-level-3 {
  background: rgba(37, 99, 235, 0.52);
}

.writing-stats-legend-cell.is-level-4,
.writing-stats-cell.is-level-4 {
  background: rgba(37, 99, 235, 0.78);
}

.writing-stats-heatmap-wrap {
  display: flex;
  gap: 8px;
  min-height: 0;
}

.writing-stats-weekdays {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  gap: 3px;
  padding-top: 18px;
  font-size: 10px;
  line-height: 12px;
  color: var(--color-secondary-text);
}

.writing-stats-heatmap-scroll {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 4px;
}

.writing-stats-heatmap-months {
  display: flex;
  gap: 3px;
  margin-bottom: 4px;
  min-height: 14px;
}

.writing-stats-month-label {
  width: 12px;
  flex: 0 0 12px;
  font-size: 10px;
  line-height: 14px;
  color: var(--color-secondary-text);
  white-space: nowrap;
  overflow: visible;
}

.writing-stats-heatmap-grid {
  display: flex;
  gap: 3px;
  width: max-content;
}

.writing-stats-week-col {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  gap: 3px;
}

.writing-stats-cell {
  border: 0;
  padding: 0;
  cursor: pointer;
}

.writing-stats-cell.is-outside {
  opacity: 0;
  pointer-events: none;
}

.writing-stats-cell.is-today {
  outline: 1px solid rgba(37, 99, 235, 0.55);
  outline-offset: 1px;
}

.writing-stats-cell:not(:disabled):hover {
  transform: scale(1.08);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 720px) {
  .writing-stats-kpis {
    grid-template-columns: 1fr;
  }
}

@container writing-stats (max-width: 760px) {
  .writing-stats-kpis {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .writing-stats-kpi {
    padding: 14px 16px;
  }

  .writing-stats-kpi-value {
    font-size: 24px;
  }

  .writing-stats-goal-input,
  .writing-stats-goal-input-mirror {
    font-size: 24px;
  }

  .writing-stats-goal-input-shell.is-compact .writing-stats-goal-input,
  .writing-stats-goal-input-shell.is-compact .writing-stats-goal-input-mirror {
    font-size: 20px;
  }

  .writing-stats-card {
    padding: 14px;
  }

  .writing-stats-card-head {
    flex-wrap: wrap;
  }

  .writing-stats-card-meta,
  .writing-stats-legend {
    font-size: 11px;
  }
}

@container writing-stats (max-width: 420px) {
  .writing-stats-kpi-value {
    font-size: 22px;
  }

  .writing-stats-goal-input,
  .writing-stats-goal-input-mirror {
    font-size: 22px;
  }

  .writing-stats-card-title {
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .writing-stats-kpi--streak.is-streak-legend::after {
    animation: none;
  }
}
</style>

<style>
@keyframes writing-stats-streak-shimmer {
  0% {
    transform: translateX(-120%) skewX(-18deg);
  }
  100% {
    transform: translateX(420%) skewX(-18deg);
  }
}
.writing-stats-tooltip {
  position: fixed;
  z-index: 220;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
</style>
