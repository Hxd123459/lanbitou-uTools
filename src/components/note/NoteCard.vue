<template>
  <article class="note-card" @click="emit('copy', contentText)">
    <div class="note-meta">
      <span v-if="titleText" class="note-tag">{{ titleText }}</span>
      <span class="note-time">{{ timeText }}</span>
    </div>

    <template v-if="note?.isPending">
      <div class="skeleton-line w-70" />
      <div class="skeleton-line w-100" />
      <div class="skeleton-line w-85" />
    </template>
    <template v-else>
      <MarkdownRender
        :nodes="markdownNodes"
        :typewriter="false"
        :batch-rendering="false"
        :defer-nodes-until-visible="false"
      />
      <p v-if="!markdownNodes.length" class="note-text-fallback">
        {{ contentText || '（暂无内容）' }}
      </p>
    </template>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import {
  MarkdownRender,
  getMarkdown,
  parseMarkdownToStructure,
} from 'vue-renderer-markdown'

const props = defineProps({
  note: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['copy'])
const contentText = computed(
  () => props.note?.updateContent || props.note?.text || '',
)
const titleText = computed(
  () => props.note?.title || '',
)
const timeText = computed(() => formatTime(props.note?.createdAt))

const md = getMarkdown('note-card')
const markdownNodes = computed(() => {
  const text = contentText.value
  if (!text) return []
  try {
    return parseMarkdownToStructure(text, md)
  } catch (error) {
    console.error('[NoteCard] parse markdown failed:', error)
    return []
  }
})

function formatTime(dateValue) {
  if (!dateValue) return '----'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '----'
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}
</script>

<style scoped>
.note-card {
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.note-card:hover {
  border-color: #d4d4d8;
  box-shadow: 0 4px 14px rgba(24, 24, 27, 0.08);
}

.note-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.note-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.2px;
}

.note-time {
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.note-card :deep(p) {
  margin: 0;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.note-text-fallback {
  margin: 0;
  color: var(--color-secondary-text);
  font-size: 13px;
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
  margin-top: 8px;
  background: linear-gradient(90deg, #ececf0 25%, #f5f5f7 37%, #ececf0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.3s ease infinite;
}

.w-70 {
  width: 70%;
}

.w-85 {
  width: 85%;
}

.w-100 {
  width: 100%;
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
