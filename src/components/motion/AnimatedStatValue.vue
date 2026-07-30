<template>
  <span class="animated-stat-value">{{ displayText }}</span>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useMotionValue, useMotionValueEvent, useSpring } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  value: { type: Number, default: 0 },
  format: { type: Function, required: true },
  fromZero: { type: Boolean, default: false },
})

const { reduced } = useMotionPresets()
const initialValue = props.fromZero && !reduced.value ? 0 : props.value
const displayText = ref(props.format(initialValue))
const target = useMotionValue(initialValue)
const spring = useSpring(
  target,
  reduced.value
    ? { stiffness: 10000, damping: 1000 }
    : { stiffness: 90, damping: 20, mass: 0.85 },
)

const syncDisplay = (raw) => {
  displayText.value = props.format(raw)
}

useMotionValueEvent(spring, 'change', syncDisplay)

const applyValue = (next, instant = false) => {
  const n = Number(next) || 0
  if (reduced.value || instant) {
    target.jump(n)
    syncDisplay(n)
    return
  }
  target.set(n)
}

onMounted(() => {
  if (props.fromZero && !reduced.value) {
    applyValue(props.value)
  }
})

watch(
  () => props.value,
  (next) => {
    applyValue(next)
  },
)

watch(
  reduced,
  (isReduced) => {
    if (isReduced) applyValue(props.value, true)
  },
)
</script>

<style scoped>
.animated-stat-value {
  font-variant-numeric: tabular-nums;
}
</style>
