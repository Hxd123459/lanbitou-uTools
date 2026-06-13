<template>
  <motion.div
    class="ai-settings-card data-backup-card"
    :initial="cardMotion.initial"
    :animate="cardMotion.animate"
    :transition="cardMotion.transition"
  >
    <h3 class="ai-settings-subtitle">数据备份</h3>
    <p class="ai-settings-desc data-backup-desc">
      导出本地碎片、沉淀与标签为 ZIP；支持导入备份包或批量导入外部 Markdown 为碎片。
    </p>

    <div class="data-backup-actions">
      <AppButton
        class="btn btn-primary data-backup-btn"
        :disabled="busy"
        @click="handleExport"
      >
        {{ busy && busyType === 'export' ? '导出中…' : '导出全部数据' }}
      </AppButton>

      <AppButton
        class="btn btn-dashed-tile data-backup-btn"
        :disabled="busy"
        @click="openZipPicker"
      >
        {{ busy && busyType === 'import-zip' ? '导入中…' : '导入备份包' }}
      </AppButton>

      <AppButton
        class="btn btn-dashed-tile data-backup-btn"
        :disabled="busy"
        @click="openMdPicker"
      >
        {{ busy && busyType === 'import-md' ? '导入中…' : '导入 Markdown' }}
      </AppButton>
    </div>

    <p v-if="progressText" class="data-backup-progress">{{ progressText }}</p>
    <p v-if="resultText" class="data-backup-result">{{ resultText }}</p>

    <input
      ref="zipInputRef"
      class="data-backup-input"
      type="file"
      accept=".zip,application/zip"
      @change="onZipSelected"
    />
    <input
      ref="mdInputRef"
      class="data-backup-input"
      type="file"
      accept=".md,text/markdown"
      multiple
      @change="onMdSelected"
    />
  </motion.div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { exportAndDownloadLanbitouBackup } from '../../backup/dataExporter'
import { importLanbitouBackup } from '../../backup/dataImporter'
import { importExternalMarkdownFiles } from '../../backup/externalMdImporter'
import AppButton from '../motion/AppButton.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['imported', 'error'])

const { presets } = useMotionPresets()

const busy = ref(false)
const busyType = ref('')
const progressText = ref('')
const resultText = ref('')
const zipInputRef = ref(null)
const mdInputRef = ref(null)

const cardMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: { ...reveal.transition, delay: 0.16 } }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})

const formatBackupSummary = (summary) => {
  const parts = [
    `碎片 +${summary.fragmentsAdded}`,
    `跳过 ${summary.fragmentsSkipped}`,
    `沉淀 +${summary.sedimentAdded}`,
    `文件夹 +${summary.foldersAdded}`,
  ]
  if (summary.errors?.length) {
    parts.push(`失败 ${summary.errors.length}`)
  }
  return parts.join('，')
}

const formatMdSummary = (summary) => {
  const parts = [`新增 ${summary.added} 条碎片`]
  if (summary.skipped) parts.push(`跳过 ${summary.skipped}`)
  if (summary.errors?.length) parts.push(`失败 ${summary.errors.length}`)
  return parts.join('，')
}

const handleExport = async () => {
  if (busy.value) return
  busy.value = true
  busyType.value = 'export'
  progressText.value = '正在打包本地数据…'
  resultText.value = ''
  try {
    const result = await exportAndDownloadLanbitouBackup()
    resultText.value = `导出完成：碎片 ${result.stats.fragments}，沉淀 ${result.stats.sedimentNotes}，附件 ${result.stats.attachments}`
  } catch (error) {
    emit('error', error?.message || '导出失败')
  } finally {
    busy.value = false
    busyType.value = ''
    progressText.value = ''
  }
}

const openZipPicker = () => {
  if (busy.value) return
  zipInputRef.value?.click()
}

const openMdPicker = () => {
  if (busy.value) return
  mdInputRef.value?.click()
}

const onZipSelected = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || busy.value) return
  busy.value = true
  busyType.value = 'import-zip'
  progressText.value = '正在导入备份包…'
  resultText.value = ''
  try {
    const summary = await importLanbitouBackup(file)
    resultText.value = formatBackupSummary(summary)
    emit('imported')
  } catch (error) {
    emit('error', error?.message || '导入失败')
  } finally {
    busy.value = false
    busyType.value = ''
    progressText.value = ''
  }
}

const onMdSelected = async (event) => {
  const files = event.target.files
  event.target.value = ''
  if (!files?.length || busy.value) return
  busy.value = true
  busyType.value = 'import-md'
  progressText.value = `正在导入 ${files.length} 个 Markdown 文件…`
  resultText.value = ''
  try {
    const summary = await importExternalMarkdownFiles(files)
    resultText.value = formatMdSummary(summary)
    emit('imported')
  } catch (error) {
    emit('error', error?.message || '导入 Markdown 失败')
  } finally {
    busy.value = false
    busyType.value = ''
    progressText.value = ''
  }
}
</script>

<style scoped>
.ai-settings-subtitle {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.data-backup-card {
  margin-top: 14px;
}

.data-backup-desc {
  margin: 0 0 16px;
}

.data-backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.data-backup-btn {
  min-width: 148px;
}

.data-backup-progress,
.data-backup-result {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-secondary-text);
}

.data-backup-result {
  color: var(--color-primary);
}

.data-backup-input {
  display: none;
}
</style>
