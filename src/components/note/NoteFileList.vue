<template>
  <div
    v-if="files.length"
    class="file-list"
    @click="onListClick"
  >
    <div
      v-for="(file, idx) in files"
      :key="file.id ?? idx"
      class="file-chip-wrap"
      :class="{
        'is-action-open': actionKey === file.key,
        'is-confirming': confirmKey === file.key,
      }"
    >
      <div
        v-if="confirmKey === file.key"
        class="file-preview-confirm"
        @click.stop
      >
        <span class="file-preview-confirm-text">
          该功能是跳转到其他插件，首次使用需要下载预览插件！
        </span>
        <div class="file-preview-confirm-actions">
          <button
            type="button"
            class="file-preview-confirm-btn file-preview-confirm-btn--yes"
            :disabled="busyKey === file.key"
            @click="confirmPreview(file)"
          >
            {{ busyKey === file.key ? '打开中…' : '确认' }}
          </button>
          <button
            type="button"
            class="file-preview-confirm-btn file-preview-confirm-btn--no"
            :disabled="busyKey === file.key"
            @click="cancelPreviewConfirm"
          >
            取消
          </button>
        </div>
      </div>

      <button
        v-else
        type="button"
        class="file-chip"
        :class="{ 'is-action-open': actionKey === file.key }"
        :title="file.name || `附件 ${idx + 1}`"
        :disabled="busyKey === file.key"
        @click.stop="onChipClick(file)"
      >
        <span class="file-chip-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <span class="file-chip-name">{{ truncateFileName(file.name || `附件 ${idx + 1}`, compact ? 14 : 22) }}</span>

        <AnimatePresence>
          <motion.div
            v-if="actionKey === file.key"
            key="actions"
            class="file-item-actions"
            role="toolbar"
            aria-label="附件操作"
            :initial="actionToolbarMotion.initial"
            :animate="actionToolbarMotion.animate"
            :exit="actionToolbarMotion.exit"
            :transition="actionToolbarMotion.transition"
            @click.stop
            @mousedown.stop
          >
            <motion.button
              type="button"
              class="file-action-btn"
              title="下载"
              aria-label="下载附件"
              :disabled="busyKey === file.key"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="onDownload(file)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            </motion.button>
            <motion.button
              type="button"
              class="file-action-btn"
              title="预览"
              aria-label="预览附件"
              :disabled="busyKey === file.key"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="onPreview(file)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </motion.button>
          </motion.div>
        </AnimatePresence>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { getAttachmentKind, getAttachmentName, truncateFileName } from '../../utils/attachmentDisplay'
import {
  downloadAttachment,
  hasSeenAttachmentPreviewTip,
  markAttachmentPreviewTipSeen,
  openAttachmentInFilePreview,
} from '../../utils/openAttachmentPreview'

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

const emit = defineEmits(['error'])

const { presets } = useMotionPresets()

const actionToolbarMotion = {
  initial: { opacity: 0, x: -6, scale: 0.94 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -4, scale: 0.97 },
  transition: { duration: 0.18, ease: 'easeOut' },
}

const actionKey = ref('')
const confirmKey = ref('')
const busyKey = ref('')

const files = computed(() =>
  (Array.isArray(props.attachments) ? props.attachments : [])
    .filter((item) => getAttachmentKind(item) === 'file')
    .map((item, idx) => ({
      key: String(item.id ?? item.key ?? idx),
      id: item.id,
      url: item.url,
      name: getAttachmentName(item, `附件 ${idx + 1}`),
      mimeType: item.mimeType || item.mime || '',
      file: item.file || null,
    })),
)

const closeMenus = () => {
  actionKey.value = ''
  confirmKey.value = ''
}

const onListClick = () => {
  if (actionKey.value || confirmKey.value) closeMenus()
}

const onChipClick = (file) => {
  if (!file || busyKey.value) return
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
.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  width: 100%;
}

.file-chip-wrap {
  flex: 0 0 auto;
  max-width: 100%;
}

.file-chip-wrap.is-action-open .file-chip {
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
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
  font: inherit;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.file-chip:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.05);
  color: var(--color-accent);
}

.file-chip:disabled {
  opacity: 0.65;
  cursor: wait;
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

.file-item-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
  padding-left: 4px;
  border-left: 1px solid var(--color-border);
}

.file-action-btn {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 7px;
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-secondary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.file-action-btn:hover:not(:disabled) {
  background: #fff;
  color: var(--color-primary);
}

.file-action-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.file-preview-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(280px, 100%);
  padding: 8px 10px;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 8px;
  background: var(--color-surface, var(--color-bg));
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
}

.file-preview-confirm-text {
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-text);
}

.file-preview-confirm-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.file-preview-confirm-btn {
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

.file-preview-confirm-btn--yes {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-accent);
}

.file-preview-confirm-btn--yes:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.14);
}

.file-preview-confirm-btn--no:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.05);
}

.file-preview-confirm-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
