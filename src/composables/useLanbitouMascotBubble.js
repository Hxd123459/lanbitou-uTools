import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const EDGE_PADDING = 10
const TAIL_INSET = 16
const GAP = 6

export function useLanbitouMascotBubble(options) {
  const tail = ref('br')
  const bubbleLeft = ref(0)
  const bubbleTop = ref(0)
  const layoutReady = ref(false)

  const recompute = async () => {
    layoutReady.value = false
    if (!options.visible?.()) return

    await nextTick()
    await nextTick()

    const bubbleEl = options.bubbleRef?.value?.$el || options.bubbleRef?.value
    const anchorEl = options.anchorRef?.value
    if (!anchorEl) return

    const anchor = anchorEl.getBoundingClientRect()

    if (!bubbleEl) {
      bubbleLeft.value = Math.round(anchor.left - 180)
      bubbleTop.value = Math.round(anchor.top - 72)
      tail.value = 'br'
      layoutReady.value = true
      return
    }
    const bubble = bubbleEl.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = EDGE_PADDING

    const headX = anchor.left + anchor.width * 0.58
    const headY = anchor.top + anchor.height * 0.12

    let nextTail = 'br'
    let left = headX - bubble.width + TAIL_INSET + 7
    let top = headY - bubble.height - GAP

    if (top < pad) {
      nextTail = 'tr'
      top = anchor.top + anchor.height * 0.28 + GAP
      left = headX - bubble.width + TAIL_INSET + 7
    }

    if (left < pad) {
      nextTail = nextTail === 'br' ? 'bl' : 'tl'
      left = headX - TAIL_INSET - 7
    }

    if (left + bubble.width > vw - pad) {
      left = vw - pad - bubble.width
    }
    if (top + bubble.height > vh - pad) {
      top = vh - pad - bubble.height
    }
    if (top < pad) top = pad

    tail.value = nextTail
    bubbleLeft.value = Math.round(left)
    bubbleTop.value = Math.round(top)
    layoutReady.value = true
  }

  watch(
    () => [
      options.visible?.(),
      options.message?.(),
      options.position?.()?.left,
      options.position?.()?.top,
      options.dragging?.(),
    ],
    () => {
      void recompute()
    },
    { immediate: true },
  )

  onMounted(() => {
    window.addEventListener('resize', recompute)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', recompute)
  })

  const hostStyle = computed(() => {
    if (!layoutReady.value) {
      return {
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        visibility: 'hidden',
      }
    }
    return {
      position: 'fixed',
      left: `${bubbleLeft.value}px`,
      top: `${bubbleTop.value}px`,
      visibility: 'visible',
    }
  })

  return {
    tail,
    hostStyle,
    layoutReady,
  }
}
