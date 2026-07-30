<template>
  <div
    ref="chartWrapRef"
    class="run-stats-bar-chart"
    :class="{ 'is-empty': isEmpty }"
    @mouseleave="hideTooltip"
  >
    <div
      v-if="isEmpty"
      class="run-stats-bar-chart-empty"
      role="img"
      :aria-label="emptyText"
    >
      {{ emptyText }}
    </div>

    <template v-else>
      <svg
        class="run-stats-bar-chart-svg"
        :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          v-for="(y, index) in gridLineYs"
          :key="`grid-${index}`"
          class="run-stats-bar-chart-grid"
          x1="8"
          :y1="y"
          :x2="CHART_WIDTH - 8"
          :y2="y"
        />
        <template v-for="bar in bars" :key="bar.key">
          <rect
            v-if="reduced"
            class="run-stats-bar-chart-bar"
            :class="{
              'is-active': hoveredKey === bar.key,
              'is-max': bar.isMax && maxValue > 0,
            }"
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="bar.height"
            rx="2"
            ry="2"
          />
          <motion.rect
            v-else
            class="run-stats-bar-chart-bar"
            :class="{
              'is-active': hoveredKey === bar.key,
              'is-max': bar.isMax && maxValue > 0,
            }"
            :x="bar.x"
            :width="bar.width"
            rx="2"
            ry="2"
            :initial="barMotionInitial"
            :animate="{ y: bar.y, height: bar.height }"
            :transition="barMotionTransition"
          />
        </template>
        <rect
          v-for="bar in bars"
          :key="`hit-${bar.key}`"
          class="run-stats-bar-chart-hit"
          :x="bar.hitX"
          :y="PLOT_TOP"
          :width="bar.hitWidth"
          :height="PLOT_HEIGHT"
          @mouseenter="showBarTooltip(bar, $event)"
          @mousemove="moveTooltip($event)"
        />
      </svg>
      <div class="run-stats-bar-chart-labels" aria-hidden="true">
        <span>{{ axisLabels.start }}</span>
        <span>{{ axisLabels.middle }}</span>
        <span>{{ axisLabels.end }}</span>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        ref="tooltipRef"
        class="run-stats-bar-chart-tooltip"
        :style="tooltipStyle"
      >
        {{ tooltip.text }}
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

const CHART_WIDTH = 400
const CHART_HEIGHT = 132
const PLOT_TOP = 10
const PLOT_BOTTOM = 4
const PLOT_HEIGHT = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM
const PLOT_PAD_X = 8
const BAR_SLOT_RATIO = 0.6
const TOOLTIP_OFFSET_Y = 46
const TOOLTIP_EDGE_PADDING = 8

const props = defineProps({
  labels: {
    type: Array,
    default: () => [],
  },
  values: {
    type: Array,
    default: () => [],
  },
  formatValue: {
    type: Function,
    default: (value) => String(value ?? 0),
  },
  emptyText: {
    type: String,
    default: '暂无执行数据',
  },
})

const { reduced } = useMotionPresets()

const barMotionInitial = computed(() =>
  reduced.value ? false : { y: PLOT_TOP + PLOT_HEIGHT, height: 0 },
)

const barMotionTransition = computed(() =>
  reduced.value
    ? { duration: 0 }
    : { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
)

const chartWrapRef = ref(null)
const tooltipRef = ref(null)
const hoveredKey = ref('')
const tooltip = ref({
  visible: false,
  text: '',
  anchorX: 0,
  anchorY: 0,
})
const tooltipSize = ref({ width: 0, height: 0 })

const pairs = computed(() => {
  const labels = Array.isArray(props.labels) ? props.labels : []
  const values = Array.isArray(props.values) ? props.values : []
  const count = Math.min(labels.length, values.length)
  return Array.from({ length: count }, (_, index) => ({
    key: `${index}-${labels[index]}`,
    label: String(labels[index] ?? ''),
    value: Math.max(0, Number(values[index]) || 0),
  }))
})

const isEmpty = computed(() => pairs.value.length === 0)

const maxValue = computed(() => {
  const peak = pairs.value.reduce((max, item) => Math.max(max, item.value), 0)
  return peak > 0 ? peak : 1
})

const bars = computed(() => {
  const items = pairs.value
  const count = items.length
  if (!count) return []

  const plotWidth = CHART_WIDTH - PLOT_PAD_X * 2
  const slotWidth = plotWidth / count
  const barWidth = Math.max(2, slotWidth * BAR_SLOT_RATIO)

  return items.map((item, index) => {
    const height = (item.value / maxValue.value) * PLOT_HEIGHT
    const x = PLOT_PAD_X + index * slotWidth + (slotWidth - barWidth) / 2
    const y = PLOT_TOP + PLOT_HEIGHT - height
    return {
      key: item.key,
      label: item.label,
      value: item.value,
      x,
      y,
      width: barWidth,
      height,
      hitX: PLOT_PAD_X + index * slotWidth,
      hitWidth: slotWidth,
      isMax: item.value === maxValue.value && item.value > 0,
      tooltip: `${item.label} · ${props.formatValue(item.value)}`,
    }
  })
})

const gridLineYs = computed(() => {
  const steps = 3
  return Array.from({ length: steps }, (_, index) => {
    const ratio = (index + 1) / (steps + 1)
    return PLOT_TOP + PLOT_HEIGHT * (1 - ratio)
  })
})

const shortLabel = (text) => {
  const raw = String(text ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(5)
  return raw
}

const axisLabels = computed(() => {
  const items = pairs.value
  if (!items.length) {
    return { start: '', middle: '', end: '' }
  }
  const middleIndex = Math.floor((items.length - 1) / 2)
  return {
    start: shortLabel(items[0].label),
    middle: shortLabel(items[middleIndex].label),
    end: shortLabel(items[items.length - 1].label),
  }
})

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

const moveTooltip = (event) => {
  tooltip.value.anchorX = event.clientX
  tooltip.value.anchorY = event.clientY - TOOLTIP_OFFSET_Y
  measureTooltip()
}

const showBarTooltip = (bar, event) => {
  hoveredKey.value = bar.key
  tooltip.value = {
    visible: true,
    text: bar.tooltip,
    anchorX: event.clientX,
    anchorY: event.clientY - TOOLTIP_OFFSET_Y,
  }
  void nextTick(measureTooltip)
}

const hideTooltip = () => {
  tooltip.value.visible = false
  hoveredKey.value = ''
}

watch(
  () => tooltip.value.text,
  () => {
    if (!tooltip.value.visible) return
    void nextTick(measureTooltip)
  },
)
</script>

<style scoped>
.run-stats-bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.run-stats-bar-chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 132px;
  border-radius: var(--radius-md, 8px);
  border: 1px dashed rgba(30, 64, 175, 0.14);
  background: rgba(248, 250, 252, 0.72);
  color: var(--color-secondary-text);
  font-size: 13px;
}

.run-stats-bar-chart-svg {
  width: 100%;
  height: 132px;
  display: block;
}

.run-stats-bar-chart-grid {
  stroke: rgba(30, 58, 138, 0.08);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.run-stats-bar-chart-bar {
  fill: rgba(24, 24, 27, 0.72);
  transition: fill 160ms ease, opacity 160ms ease;
}

.run-stats-bar-chart-bar.is-max {
  fill: var(--color-primary);
}

.run-stats-bar-chart-bar.is-active {
  fill: var(--btn-primary-bg-hover, var(--color-primary));
}

.run-stats-bar-chart-hit {
  fill: transparent;
  cursor: crosshair;
}

.run-stats-bar-chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-secondary-text);
  font-variant-numeric: tabular-nums;
}
</style>

<style>
.run-stats-bar-chart-tooltip {
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
