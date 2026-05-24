<script setup>
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

defineOptions({ inheritAttrs: false })

const { presets } = useMotionPresets()
</script>

<template>
  <motion.button
    type="button"
    v-bind="$attrs"
    :while-hover="presets.button.hover"
    :while-tap="presets.button.tap"
    :transition="presets.button.transition"
  >
    <slot />
  </motion.button>
</template>
