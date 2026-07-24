<template>
  <div v-if="files.length" class="file-list">
    <a
      v-for="(file, idx) in files"
      :key="file.id ?? idx"
      class="file-chip"
      :href="file.url"
      :download="file.name || undefined"
      target="_blank"
      rel="noopener noreferrer"
      :title="file.name || `附件 ${idx + 1}`"
      @click.stop
    >
      <span class="file-chip-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>
      <span class="file-chip-name">{{ truncateFileName(file.name || `附件 ${idx + 1}`, compact ? 14 : 22) }}</span>
    </a>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getAttachmentKind, getAttachmentName, truncateFileName } from '../../utils/attachmentDisplay'

const props = defineProps({
  attachments: {
    type: Array,
    default: () => [],
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const files = computed(() =>
  (Array.isArray(props.attachments) ? props.attachments : [])
    .filter((item) => getAttachmentKind(item) === 'file')
    .map((item, idx) => ({
      id: item.id,
      url: item.url,
      name: getAttachmentName(item, `附件 ${idx + 1}`),
    })),
)
</script>

<style scoped>
.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  width: 100%;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.file-chip:hover {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.05);
  color: var(--color-accent);
}

.file-chip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.file-chip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-accent);
  flex-shrink: 0;
}

.file-chip-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
