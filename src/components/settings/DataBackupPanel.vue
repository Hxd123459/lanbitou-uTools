<template>
  <motion.div
    class="ai-settings-card data-backup-card"
    :initial="cardMotion.initial"
    :animate="cardMotion.animate"
    :transition="cardMotion.transition"
  >
    <SettingsSectionHeading title="数据备份" />

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

    <div v-if="mdImporting" class="data-backup-md-progress">
      <div class="data-backup-bar">
        <div class="data-backup-bar-fill" :style="{ width: `${mdPercent}%` }" />
      </div>
      <p class="data-backup-bar-text">{{ mdProgressText }}</p>
    </div>

    <p v-if="progressText && busyType !== 'import-md'" class="data-backup-progress">{{ progressText }}</p>
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
      class="data-backup-file-input"
      type="file"
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
import SettingsSectionHeading from './SettingsSectionHeading.vue'

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
    ? { initial: reveal.initial, animate: reveal.animate, transition: { ...reveal.transition, delay: 0.24 } }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})

const formatBackupSummary = (summary) => {
  const parts = [
    `碎片 +${summary.fragmentsAdded}`,
    summary.fragmentsUpdated ? `更新 ${summary.fragmentsUpdated}` : '',
    `跳过 ${summary.fragmentsSkipped}`,
    `沉淀 +${summary.sedimentAdded}`,
    summary.sedimentUpdated ? `更新 ${summary.sedimentUpdated}` : '',
    `文件夹 +${summary.foldersAdded}`,
    summary.foldersUpdated ? `更新 ${summary.foldersUpdated}` : '',
    `事情 +${summary.projectsAdded}`,
    summary.projectsUpdated ? `更新 ${summary.projectsUpdated}` : '',
    `待办 +${summary.todosAdded}`,
    summary.todosUpdated ? `更新 ${summary.todosUpdated}` : '',
  ].filter(Boolean)
  if (summary.errors?.length) {
    parts.push(`失败 ${summary.errors.length}`)
    const firstError = summary.errors[0]?.message
    if (firstError) parts.push(firstError)
  }
  return parts.join('，')
}

const mdImporting = ref(false)
const mdCurrent = ref(0)
const mdTotal = ref(0)
const mdFileName = ref('')

const mdPercent = computed(() => {
  if (!mdTotal.value) return 0
  return Math.round((mdCurrent.value / mdTotal.value) * 100)
})

const mdProgressText = computed(() => {
  if (!mdTotal.value) return '准备导入…'
  const tail = mdFileName.value ? `：${mdFileName.value}` : ''
  return `${mdCurrent.value} / ${mdTotal.value}${tail}`
})

const formatMdSummary = (summary) => {
  if (!summary.picked) return '未选择文件'
  if (!summary.total) return `已选 ${summary.picked} 个文件，但没有有效的 .md / .markdown 文件`
  const parts = [`新增 ${summary.added} 条碎片`]
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
    resultText.value = `导出完成：碎片 ${result.stats.fragments}，沉淀 ${result.stats.sedimentNotes}，附件 ${result.stats.attachments}，事情 ${result.stats.projects}，待办 ${result.stats.todos}`
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
  if (!files?.length || busy.value) {
    event.target.value = ''
    return
  }
  busy.value = true
  busyType.value = 'import-md'
  mdImporting.value = true
  mdCurrent.value = 0
  mdTotal.value = files.length
  mdFileName.value = ''
  resultText.value = ''
  try {
    const summary = await importExternalMarkdownFiles(files, {
      onProgress: ({ current, total, fileName }) => {
        mdCurrent.value = current
        mdTotal.value = total
        mdFileName.value = fileName
      },
    })
    resultText.value = formatMdSummary(summary)
    if (summary.added > 0) emit('imported', { type: 'markdown', summary })
    else if (summary.errors?.length) emit('error', summary.errors[0].message)
    else emit('error', resultText.value)
  } catch (error) {
    emit('error', error?.message || '导入 Markdown 失败')
  } finally {
    busy.value = false
    busyType.value = ''
    mdImporting.value = false
    event.target.value = ''
  }
}
</script>

<style scoped>
.data-backup-card {
  margin-top: 14px;
}

.data-backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.data-backup-btn {
  box-sizing: border-box;
  min-width: 148px;
  height: 30px;
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

.data-backup-md-progress {
  margin-top: 10px;
  width: 100%;
}

.data-backup-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  overflow: hidden;
}

.data-backup-bar-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.15s ease;
}

.data-backup-bar-text {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.data-backup-input,
.data-backup-file-input {
  position: fixed;
  left: -9999px;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
