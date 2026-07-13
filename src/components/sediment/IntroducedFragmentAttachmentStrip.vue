<template>
  <div v-if="fileItems.length" class="introduced-attachment-strip">
    <div
      v-for="file in fileItems"
      :key="file.key"
      class="introduced-file-chip"
      :class="{ 'is-disabled': disabled }"
    >
      <a
        class="introduced-file-chip-link"
        :href="file.url || undefined"
        :download="file.url ? file.name : undefined"
        :target="file.url ? '_blank' : undefined"
        :rel="file.url ? 'noopener noreferrer' : undefined"
        :title="file.name"
        @click="onLinkClick($event, file)"
      >
        <span class="introduced-file-chip-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <span class="introduced-file-chip-name">{{ truncateFileName(file.name, 14) }}</span>
        <span v-if="file.ext" class="introduced-file-chip-ext">{{ file.ext }}</span>
      </a>
      <button
        type="button"
        class="introduced-file-chip-remove"
        :disabled="disabled"
        aria-label="移除附件"
        @click.stop="emit('remove', file.key)"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getAttachmentName, getFileExtension, truncateFileName } from '../../utils/attachmentDisplay'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['remove'])

const fileItems = computed(() =>
  (Array.isArray(props.items) ? props.items : [])
    .filter((item) => item?.kind === 'file')
    .map((item, idx) => ({
      key: item.key,
      url: item.url,
      name: getAttachmentName(item, `附件 ${idx + 1}`),
      ext: getFileExtension(getAttachmentName(item)),
    })),
)

const onLinkClick = (event, file) => {
  if (!file.url) event.preventDefault()
}
</script>

<style scoped>
.introduced-attachment-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
  margin-bottom: 10px;
}

.introduced-file-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 32px;
  padding-right: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.introduced-file-chip:hover:not(.is-disabled) {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.05);
}

.introduced-file-chip-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 6px 4px 10px;
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
}

.introduced-file-chip:hover:not(.is-disabled) .introduced-file-chip-link {
  color: var(--color-accent);
}

.introduced-file-chip-icon {
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

.introduced-file-chip-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.introduced-file-chip-ext {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--color-secondary-text);
}

.introduced-file-chip-remove {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #18181b;
  opacity: 0;
  overflow: hidden;
  cursor: pointer;
  transition:
    width 0.15s ease,
    opacity 0.15s ease,
    margin 0.15s ease;
}

.introduced-file-chip:hover:not(.is-disabled) .introduced-file-chip-remove {
  width: 22px;
  margin-right: 2px;
  opacity: 1;
}

.introduced-file-chip-remove:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.08);
}

.introduced-file-chip-remove:disabled {
  cursor: not-allowed;
}
</style>
