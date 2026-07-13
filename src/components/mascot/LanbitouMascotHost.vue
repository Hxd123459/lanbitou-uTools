<template>
  <Teleport to="body">
    <LanbitouMascot
      v-if="enabled"
      :phase="phase"
      :message="message"
    />
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { generateMascotFragmentFeedback } from '../../ai/lanbitouMascotService'
import {
  isLanbitouMascotEnabled,
  lanbitouMascotState,
  onLanbitouFragmentSaved,
  setLanbitouMascotSpeaking,
} from '../../mascot/lanbitouMascotApi'
import LanbitouMascot from './LanbitouMascot.vue'

const enabled = computed(() => lanbitouMascotState.enabled)
const phase = computed(() => lanbitouMascotState.phase)
const message = computed(() => lanbitouMascotState.message)

const queue = []
let draining = false
let unsubscribe = null

const drainQueue = async () => {
  if (draining) return
  draining = true
  while (queue.length) {
    const payload = queue.shift()
    try {
      const reply = await generateMascotFragmentFeedback(payload)
      setLanbitouMascotSpeaking(reply, { duration: 7000 })
      await new Promise((resolve) => window.setTimeout(resolve, 7600))
    } catch {
      setLanbitouMascotSpeaking('记下了！好记性不如烂笔头～', { duration: 5000 })
      await new Promise((resolve) => window.setTimeout(resolve, 5600))
    }
  }
  draining = false
}

const enqueueFragment = (payload) => {
  if (!isLanbitouMascotEnabled()) return
  queue.push(payload)
  void drainQueue()
}

onMounted(() => {
  unsubscribe = onLanbitouFragmentSaved(enqueueFragment)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  queue.length = 0
})
</script>
