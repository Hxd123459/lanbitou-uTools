<template>
  <div ref="containerRef" class="fade-swap-container">
    <Transition
      name="fade-swap"
      mode="out-in"
      @before-leave="onBeforeLeave"
      @enter="onEnter"
      @after-enter="onAfterEnter"
    >
      <div :key="activeKey" class="fade-swap-panel">
        <slot :name="activeKey" />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  activeKey: {
    type: String,
    required: true,
  },
})

const containerRef = ref(null)

const onBeforeLeave = () => {
  if (!containerRef.value) return
  containerRef.value.style.height = `${containerRef.value.offsetHeight}px`
}

const onEnter = (el) => {
  if (!containerRef.value) return
  requestAnimationFrame(() => {
    containerRef.value.style.height = `${el.offsetHeight}px`
  })
}

const onAfterEnter = () => {
  if (!containerRef.value) return
  containerRef.value.style.height = 'auto'
}
</script>

<style scoped>
.fade-swap-container {
  transition: height var(--motion-fast);
}

.fade-swap-panel {
  width: 100%;
}

.fade-swap-enter-active,
.fade-swap-leave-active {
  transition: opacity var(--motion-fast);
}

.fade-swap-enter-from,
.fade-swap-leave-to {
  opacity: 0;
}
</style>
