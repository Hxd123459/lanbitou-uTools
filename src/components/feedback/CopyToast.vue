<template>
  <Transition name="toast">
    <div v-if="visible" class="copy-toast">
      {{ text }}
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    default: '复制成功',
  },
})
</script>

<style scoped>
.copy-toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 120;
  height: 36px;
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 10px;
  color: #fff;
  background: var(--color-success);
  font-size: 13px;
}

.toast-enter-active,
.toast-leave-active {
  transition: all var(--motion-fast);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
