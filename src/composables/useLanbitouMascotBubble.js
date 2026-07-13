import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getMascotBodyRect } from './useLanbitouMascotDrag'

const EDGE_PADDING = 12
const BUBBLE_GAP = 10
const BUBBLE_MAX_WIDTH = 280

function estimateBubbleSize(message) {
  const text = String(message ?? '')
  const charsPerLine = 18
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine))
  const width = Math.min(
    BUBBLE_MAX_WIDTH,
    Math.max(120, Math.min(text.length * 14 + 28, BUBBLE_MAX_WIDTH)),
  )
  const height = lines * 22 + 20
  return { width, height }
}

function resolveBubblePlacement(bodyRect, bubbleSize) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = EDGE_PADDING

  const placements = [
    {
      key: 'above-right',
      left: bodyRect.right - bubbleSize.width,
      top: bodyRect.top - bubbleSize.height - BUBBLE_GAP,
    },
    {
      key: 'above-left',
      left: bodyRect.left,
      top: bodyRect.top - bubbleSize.height - BUBBLE_GAP,
    },
    {
      key: 'below-right',
      left: bodyRect.right - bubbleSize.width,
      top: bodyRect.bottom + BUBBLE_GAP,
    },
    {
      key: 'below-left',
      left: bodyRect.left,
      top: bodyRect.bottom + BUBBLE_GAP,
    },
    {
      key: 'left',
      left: bodyRect.left - bubbleSize.width - BUBBLE_GAP,
      top: bodyRect.top + bodyRect.height / 2 - bubbleSize.height / 2,
    },
    {
      key: 'right',
      left: bodyRect.right + BUBBLE_GAP,
      top: bodyRect.top + bodyRect.height / 2 - bubbleSize.height / 2,
    },
  ]

  const fits = (item) =>
    item.left >= pad
    && item.top >= pad
    && item.left + bubbleSize.width <= vw - pad
    && item.top + bubbleSize.height <= vh - pad

  const best = placements.find(fits) || placements[0]
  const clampedLeft = Math.max(pad, Math.min(best.left, vw - pad - bubbleSize.width))
  const clampedTop = Math.max(pad, Math.min(best.top, vh - pad - bubbleSize.height))

  return {
    placement: best.key,
    style: {
      left: `${clampedLeft}px`,
      top: `${clampedTop}px`,
      maxWidth: `${Math.min(BUBBLE_MAX_WIDTH, vw - pad * 2)}px`,
    },
  }
}

export function useLanbitouMascotBubble(options) {
  const placementKey = ref('above-right')
  const bubbleStyle = ref({})
  const tick = ref(0)

  const bump = () => {
    tick.value += 1
  }

  const recompute = () => {
    if (!options.visible?.()) return
    const message = options.message?.() || ''
    if (!message) return

    const bodyRect = getMascotBodyRect(options.position?.(), {
      peek: options.peek?.() === true,
    })
    const bubbleSize = estimateBubbleSize(message)
    const result = resolveBubblePlacement(bodyRect, bubbleSize)
    placementKey.value = result.placement
    bubbleStyle.value = result.style
  }

  watch(
    () => [
      options.visible?.(),
      options.message?.(),
      options.position?.()?.left,
      options.position?.()?.top,
      options.dragging?.(),
      tick.value,
    ],
    () => recompute(),
    { immediate: true },
  )

  onMounted(() => {
    window.addEventListener('resize', bump)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', bump)
  })

  const bubbleClass = computed(() => `is-placement-${placementKey.value}`)

  return {
    bubbleStyle,
    bubbleClass,
    recompute,
  }
}
