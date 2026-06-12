<template>
  <Teleport to="body">
    <Transition name="bulk-ai-tag-progress">
      <div
        v-if="visible"
        class="bulk-ai-tag-progress"
        role="status"
        aria-live="polite"
      >
        <span class="bulk-ai-tag-progress-icon" aria-hidden="true">
          <svg
            viewBox="0 0 1024 1024"
            width="16"
            height="16"
            fill="currentColor"
          >
            <path d="M276.16 334.4c-20.544 14.72-44.352 25.6-91.712 47.168-29.76 13.504-45.248 20.672-50.112 29.824a32.64 32.64 0 0 0 0 30.592c4.864 9.152 20.352 16.32 50.112 29.824 47.36 21.568 71.168 32.384 91.712 47.104a256 256 0 0 1 58.048 58.112c14.72 20.48 25.6 44.352 47.168 91.712 13.504 29.76 20.672 45.248 29.824 50.112 9.472 5.12 21.12 5.12 30.592 0 9.152-4.864 16.32-20.352 29.824-50.112 21.568-47.36 32.384-71.168 47.168-91.712a256 256 0 0 1 58.048-58.048c20.48-14.784 44.352-25.6 91.712-47.168 29.76-13.568 45.248-20.672 50.112-29.824a32.64 32.64 0 0 0 0-30.592c-4.864-9.152-20.352-16.32-50.112-29.824-47.36-21.568-71.168-32.384-91.712-47.168a256 256 0 0 1-58.048-58.048c-14.784-20.544-25.6-44.352-47.168-91.712-13.504-29.76-20.672-45.248-29.824-50.112a32.64 32.64 0 0 0-30.592 0c-9.152 4.864-16.32 20.352-29.824 50.112-21.568 47.36-32.384 71.168-47.168 91.712a256 256 0 0 1-58.048 58.048z m409.216 392.32c-7.04 4.416-14.784 7.936-30.208 14.912-12.864 5.888-19.712 9.024-22.592 12.416a21.568 21.568 0 0 0 0 27.968c2.88 3.328 9.728 6.528 22.592 12.352 15.36 7.04 23.168 10.56 30.208 14.912 16.64 10.368 30.784 24.512 41.216 41.216 4.352 7.04 7.872 14.72 14.848 30.208 5.888 12.8 9.024 19.712 12.416 22.592a21.504 21.504 0 0 0 27.968 0c3.328-2.944 6.528-9.792 12.352-22.656 7.04-15.36 10.56-23.168 14.912-30.144 10.368-16.704 24.512-30.848 41.216-41.216 7.04-4.352 14.72-7.872 30.208-14.912 12.8-5.824 19.712-8.96 22.592-12.352a21.504 21.504 0 0 0 0-28.032c-2.88-3.328-9.728-6.464-22.592-12.352-15.424-7.04-23.232-10.496-30.208-14.848a128.064 128.064 0 0 1-41.216-41.28 274.112 274.112 0 0 1-14.912-30.144c-5.824-12.864-8.96-19.712-12.352-22.656a21.568 21.568 0 0 0-27.968 0c-3.392 2.944-6.528 9.792-12.416 22.656-7.04 15.36-10.496 23.168-14.848 30.144a128.064 128.064 0 0 1-41.216 41.216z" />
          </svg>
        </span>
        <span class="bulk-ai-tag-progress-text">
          AI自动打标签中...({{ done }}/{{ total }})
        </span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  done: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
  },
})
</script>

<style scoped>
.bulk-ai-tag-progress {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 225;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  background: #18181b;
  box-shadow: var(--shadow-float);
  color: #fafafa;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.bulk-ai-tag-progress-icon {
  display: inline-flex;
  color: #fafafa;
}

.bulk-ai-tag-progress-enter-active,
.bulk-ai-tag-progress-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.bulk-ai-tag-progress-enter-from,
.bulk-ai-tag-progress-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
