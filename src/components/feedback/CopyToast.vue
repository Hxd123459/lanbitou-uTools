<template>
  <Transition name="toast">
    <div v-if="visible" class="copy-toast" :class="type">
      <span class="toast-text">{{ text }}</span>
      <button
        v-if="actionLabel"
        class="toast-action"
        type="button"
        @click="onActionClick"
      >
        {{ actionLabel }}
      </button>
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    default: '复制成功',
  },
  type: {
    type: String,
    default: 'success',
  },
  actionLabel: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['action'])

const onActionClick = () => {
  emit('action')
}
</script>

<style scoped>
.copy-toast {
  position: fixed;
  left: 24px;
  bottom: 24px;
  z-index: 120;
  height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px 0 16px;
  border-radius: 10px;
  color: #fff;
  background: rgba(24, 24, 27, 0.92);
  backdrop-filter: saturate(160%) blur(8px);
  -webkit-backdrop-filter: saturate(160%) blur(8px);
  font-size: 13px;
  box-shadow: 0 10px 30px rgba(24, 24, 27, 0.18);
}

.copy-toast.success {
  background: rgba(24, 24, 27, 0.92);
}

.copy-toast.error {
  background: var(--color-error);
}

.toast-text {
  white-space: nowrap;
  letter-spacing: 0.2px;
}

.toast-action {
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--motion-fast);
}

.toast-action:hover {
  background: rgba(255, 255, 255, 0.28);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--motion-fast), transform var(--motion-fast);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
