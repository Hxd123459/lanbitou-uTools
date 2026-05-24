import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/** 与历史 --motion-fast 对齐，供 motion-v transition.duration 使用（秒） */
export const MOTION_DURATION = 0.18

const OFF = { duration: 0 }
const FAST = { duration: MOTION_DURATION, ease: 'easeOut' }

let mediaQuery = null
const prefersReducedMotion = ref(false)

function syncReducedMotion() {
  prefersReducedMotion.value = mediaQuery?.matches ?? false
}

export function useMotionPresets() {
  onMounted(() => {
    if (typeof window === 'undefined') return
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    syncReducedMotion()
    mediaQuery.addEventListener('change', syncReducedMotion)
  })

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener('change', syncReducedMotion)
  })

  const reduced = computed(() => prefersReducedMotion.value)

  const presets = computed(() => {
    if (reduced.value) {
      return {
        fast: OFF,
        button: { hover: undefined, tap: undefined, transition: OFF },
        reveal: {
          initial: {},
          animate: {},
          exit: {},
          transition: OFF,
        },
        fade: {
          initial: {},
          animate: { opacity: 1 },
          exit: {},
          transition: OFF,
        },
        swapLabel: {
          initial: {},
          animate: {},
          exit: {},
          transition: OFF,
        },
        toast: {
          initial: {},
          animate: {},
          exit: {},
          transition: OFF,
        },
        thumbPop: {
          initial: { opacity: 1, scale: 1 },
          animate: { opacity: 1, scale: 1 },
          transition: OFF,
        },
        sidebar: {
          initial: { opacity: 1, x: 0 },
          animate: { opacity: 1, x: 0 },
          transition: OFF,
        },
        layoutSpring: OFF,
      }
    }

    return {
      fast: FAST,
      button: {
        hover: { scale: 1.02 },
        tap: { scale: 0.98 },
        transition: FAST,
      },
      reveal: {
        initial: { opacity: 0, y: 5 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 5 },
        transition: FAST,
      },
      fade: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: FAST,
      },
      swapLabel: {
        initial: { opacity: 0, scale: 0.94 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.94 },
        transition: FAST,
      },
      toast: {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 8 },
        transition: FAST,
      },
      thumbPop: {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        transition: FAST,
      },
      sidebar: {
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.3, ease: 'easeOut' },
      },
      layoutSpring: { type: 'spring', bounce: 0.2, duration: 0.4 },
    }
  })

  return { presets, reduced }
}
