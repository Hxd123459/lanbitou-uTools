<template>
  <div
    v-if="visible"
    class="struct-note-ai-composing"
    role="status"
    aria-live="polite"
  >
    <div class="struct-note-ai-composing-badge">
      <span class="struct-note-ai-composing-pulse" aria-hidden="true" />
      <span class="struct-note-ai-composing-title">{{ title }}</span>
      <span class="struct-note-ai-composing-elapsed" :title="`已耗时 ${elapsedLabel}`">
        已耗时 {{ elapsedLabel }}
      </span>
      <button
        type="button"
        class="struct-note-ai-composing-stop"
        @click="emit('stop')"
      >
        停止
      </button>
    </div>
    <p v-if="progressLabel" class="struct-note-ai-composing-progress">
      {{ progressLabel }}
    </p>
    <div
      v-if="preview"
      class="struct-note-ai-composing-preview"
    >{{ preview }}</div>
    <p v-else class="struct-note-ai-composing-waiting">正在生成正文…</p>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'AI 整理中' },
  elapsedLabel: { type: String, default: '0:00' },
  progressLabel: { type: String, default: '' },
  preview: { type: String, default: '' },
})

const emit = defineEmits(['stop'])
</script>

<style scoped>
.struct-note-ai-composing {
  position: relative;
  margin: 12px 0 16px;
  padding: 10px 12px 12px 14px;
  border-left: 3px solid rgba(37, 99, 235, 0.55);
  border-radius: 0 10px 10px 0;
  background: rgba(37, 99, 235, 0.04);
  box-sizing: border-box;
}

.struct-note-ai-composing-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.struct-note-ai-composing-pulse {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
  animation: struct-note-ai-pulse 1.4s ease-out infinite;
}

.struct-note-ai-composing-title {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 560;
  color: #1d4ed8;
  letter-spacing: 0.01em;
}

.struct-note-ai-composing-elapsed {
  flex: 0 0 auto;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 500;
  color: #1d4ed8;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.struct-note-ai-composing-stop {
  flex: 0 0 auto;
  padding: 2px 10px;
  border: 0;
  border-radius: 7px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease;
}

.struct-note-ai-composing-stop:hover {
  background: rgba(24, 24, 27, 0.1);
  color: var(--color-primary);
}

.struct-note-ai-composing-progress {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--color-secondary-text);
}

.struct-note-ai-composing-waiting {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
}

.struct-note-ai-composing-preview {
  margin-top: 10px;
  max-height: 220px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

@keyframes struct-note-ai-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
  }
}
</style>
