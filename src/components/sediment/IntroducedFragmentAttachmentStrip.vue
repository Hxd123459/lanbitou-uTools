<template>
  <div
    v-if="fileItems.length"
    class="introduced-attachment-strip"
    @click="onStripClick"
  >
    <div
      v-for="file in fileItems"
      :key="file.key"
      class="introduced-file-chip"
      :class="{
        'is-disabled': disabled,
        'is-action-open': actionKey === file.key,
        'is-confirming': confirmKey === file.key,
      }"
    >
      <div
        v-if="confirmKey === file.key"
        class="introduced-preview-confirm"
        @click.stop
      >
        <span class="introduced-preview-confirm-text">
          该功能是跳转到其他插件，首次使用需要下载预览插件！
        </span>
        <div class="introduced-preview-confirm-actions">
          <button
            type="button"
            class="introduced-preview-confirm-btn introduced-preview-confirm-btn--yes"
            :disabled="busyKey === file.key"
            @click="confirmPreview(file)"
          >
            {{ busyKey === file.key ? '打开中…' : '确认' }}
          </button>
          <button
            type="button"
            class="introduced-preview-confirm-btn introduced-preview-confirm-btn--no"
            :disabled="busyKey === file.key"
            @click="cancelPreviewConfirm"
          >
            取消
          </button>
        </div>
      </div>

      <template v-else>
        <button
          type="button"
          class="introduced-file-chip-link"
          :title="file.name"
          :disabled="disabled || busyKey === file.key"
          @click.stop="onChipClick(file)"
        >
          <span class="introduced-file-chip-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <span class="introduced-file-chip-name">{{ truncateFileName(file.name, 14) }}</span>
          <span v-if="file.ext" class="introduced-file-chip-ext">{{ file.ext }}</span>

          <span
            v-if="actionKey === file.key"
            class="introduced-file-actions"
            role="toolbar"
            aria-label="附件操作"
            @click.stop
          >
            <button
              type="button"
              class="introduced-file-action-btn"
              title="下载"
              aria-label="下载附件"
              :disabled="busyKey === file.key"
              @click="onDownload(file)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            </button>
            <button
              type="button"
              class="introduced-file-action-btn"
              title="预览"
              aria-label="预览附件"
              :disabled="busyKey === file.key"
              @click="onPreview(file)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </span>
        </button>
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
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { getAttachmentName, getFileExtension, truncateFileName } from '../../utils/attachmentDisplay'
import {
  downloadAttachment,
  hasSeenAttachmentPreviewTip,
  markAttachmentPreviewTipSeen,
  openAttachmentInFilePreview,
} from '../../utils/openAttachmentPreview'

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

const emit = defineEmits(['remove', 'error'])

const actionKey = ref('')
const confirmKey = ref('')
const busyKey = ref('')

const fileItems = computed(() =>
  (Array.isArray(props.items) ? props.items : [])
    .filter((item) => item?.kind === 'file')
    .map((item, idx) => ({
      key: item.key,
      url: item.url,
      name: getAttachmentName(item, `附件 ${idx + 1}`),
      mimeType: item.mimeType || item.mime || '',
      file: item.file || null,
      ext: getFileExtension(getAttachmentName(item)),
    })),
)

const closeMenus = () => {
  actionKey.value = ''
  confirmKey.value = ''
}

const onStripClick = () => {
  if (actionKey.value || confirmKey.value) closeMenus()
}

const onChipClick = (file) => {
  if (props.disabled || !file || busyKey.value) return
  if (confirmKey.value) {
    confirmKey.value = ''
    return
  }
  if (actionKey.value === file.key) {
    actionKey.value = ''
    return
  }
  actionKey.value = file.key
}

const runBusy = async (file, task) => {
  if (!file || busyKey.value) return
  busyKey.value = file.key
  try {
    await task()
  } catch (error) {
    emit('error', error)
    console.error('[烂笔头] 附件操作失败', error)
  } finally {
    busyKey.value = ''
  }
}

const onDownload = async (file) => {
  await runBusy(file, () => downloadAttachment(file))
  closeMenus()
}

const doPreview = async (file) => {
  await runBusy(file, () => openAttachmentInFilePreview(file))
  closeMenus()
}

const onPreview = async (file) => {
  if (!file || busyKey.value) return
  if (!hasSeenAttachmentPreviewTip()) {
    actionKey.value = ''
    confirmKey.value = file.key
    return
  }
  await doPreview(file)
}

const confirmPreview = async (file) => {
  markAttachmentPreviewTipSeen()
  await doPreview(file)
}

const cancelPreviewConfirm = () => {
  confirmKey.value = ''
}
</script>

<style scoped>
.introduced-attachment-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.introduced-file-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}

.introduced-file-chip.is-disabled {
  opacity: 0.55;
}

.introduced-file-chip.is-action-open .introduced-file-chip-link {
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
}

.introduced-file-chip-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 30px;
  padding: 3px 28px 3px 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
  font: inherit;
}

.introduced-file-chip:hover:not(.is-disabled) .introduced-file-chip-link {
  border-color: rgba(37, 99, 235, 0.35);
  color: var(--color-accent);
}

.introduced-file-chip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
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
  font-size: 10px;
  color: var(--color-secondary-text);
  flex-shrink: 0;
}

.introduced-file-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 2px;
  padding-left: 4px;
  border-left: 1px solid var(--color-border);
}

.introduced-file-action-btn {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-secondary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.introduced-file-action-btn:hover:not(:disabled) {
  background: #fff;
  color: var(--color-primary);
}

.introduced-file-chip-remove {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.85);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.introduced-file-chip:hover:not(.is-disabled) .introduced-file-chip-remove {
  background: #18181b;
}

.introduced-file-chip-remove:hover:not(:disabled) {
  background: #ef4444;
}

.introduced-file-chip-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.introduced-preview-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(260px, 100%);
  padding: 8px 10px;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 8px;
  background: var(--color-surface, var(--color-bg));
}

.introduced-preview-confirm-text {
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-text);
}

.introduced-preview-confirm-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.introduced-preview-confirm-btn {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.introduced-preview-confirm-btn--yes {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-accent);
}
</style>
