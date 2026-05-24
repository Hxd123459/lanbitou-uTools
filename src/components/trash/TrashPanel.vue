<template>
  <section class="trash-panel">
    <header class="trash-notice" role="note">
      <div class="trash-notice-main">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none" />
        </svg>
        <span>回收站只保留 30 天，过期后将自动清除。</span>
      </div>
      <motion.button
        type="button"
        class="trash-clear-all"
        :disabled="loading || clearingAll || !items.length || actionLoadingId != null"
        :while-hover="presets.button.hover"
        :while-tap="presets.button.tap"
        :transition="presets.button.transition"
        @click="handleClearAll"
      >
        {{ clearingAll ? '清空中…' : '清空回收站' }}
      </motion.button>
    </header>

    <p v-if="loading" class="trash-state">加载中…</p>
    <p v-else-if="!items.length" class="trash-state">回收站为空</p>

    <ul v-else class="trash-list" role="list">
      <AnimatePresence mode="popLayout">
        <motion.li
          v-for="note in items"
          :key="note.id"
          class="trash-list-item"
          layout
          :initial="presets.reveal.initial"
          :animate="presets.reveal.animate"
          :exit="presets.listItemExit"
        >
          <article class="trash-card">
          <div class="trash-card-body">
            <div class="trash-card-meta">
              <span v-if="(note.title || '').trim()" class="trash-card-tag">
                {{ note.title }}
              </span>
              <time class="trash-card-time">{{ formatTime(note.createdAt) }}</time>
            </div>
            <p class="trash-card-preview">
              {{ previewText(note) }}
            </p>
          </div>

          <div class="trash-card-actions">
            <AppButton
              class="btn btn-primary trash-action-btn"
              :disabled="actionLoadingId === note.id"
              @click="handleRestore(note.id)"
            >
              {{ actionLoadingId === note.id ? '处理中…' : '恢复' }}
            </AppButton>
            <AppButton
              class="btn btn-icon-text trash-delete-btn"
              :disabled="actionLoadingId === note.id"
              @click="handleDeleteForever(note.id)"
            >
              彻底删除
            </AppButton>
          </div>
          </article>
        </motion.li>
      </AnimatePresence>
    </ul>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import {
  deleteRecycleForever,
  fetchRecycleList,
  restoreRecycleNote,
} from '../../api/note'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'

const { presets } = useMotionPresets()

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['count-change', 'restored', 'error'])

const items = ref([])
const loading = ref(false)
const clearingAll = ref(false)
const actionLoadingId = ref(null)
let loadToken = 0

const previewText = (note) => {
  const text = note.summary || note.text || note.markdownContent || ''
  return text.slice(0, 120) || '（暂无内容）'
}

const formatTime = (dateValue) => {
  if (!dateValue) return '----'
  const normalized = String(dateValue).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return dateValue
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

const syncCount = () => {
  emit('count-change', items.value.length)
}

const loadList = async () => {
  const token = ++loadToken
  loading.value = true
  try {
    const list = await fetchRecycleList()
    if (token !== loadToken) return
    items.value = list
    syncCount()
  } catch (error) {
    if (token !== loadToken) return
    items.value = []
    syncCount()
    emit('error', error)
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
}

const handleRestore = async (id) => {
  if (actionLoadingId.value != null) return
  actionLoadingId.value = id
  try {
    await restoreRecycleNote(id)
    items.value = items.value.filter((item) => item.id !== id)
    syncCount()
    emit('restored')
  } catch (error) {
    emit('error', error)
  } finally {
    actionLoadingId.value = null
  }
}

const handleDeleteForever = async (id) => {
  if (actionLoadingId.value != null) return
  actionLoadingId.value = id
  try {
    await deleteRecycleForever([id])
    items.value = items.value.filter((item) => item.id !== id)
    syncCount()
  } catch (error) {
    emit('error', error)
  } finally {
    actionLoadingId.value = null
  }
}

const handleClearAll = async () => {
  if (clearingAll.value || !items.value.length || actionLoadingId.value != null) {
    return
  }
  clearingAll.value = true
  try {
    const ids = items.value.map((item) => item.id)
    await deleteRecycleForever(ids)
    items.value = []
    syncCount()
  } catch (error) {
    emit('error', error)
  } finally {
    clearingAll.value = false
  }
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) loadList()
  },
  { immediate: true },
)

defineExpose({ reload: loadList })
</script>

<style scoped>
.trash-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: var(--frame-inner-width);
  padding-top: 22px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(24, 24, 27, 0.18) transparent;
}

.trash-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: #efefef;
  color: var(--color-secondary-text);
  font-size: 13px;
  line-height: 1.5;
}

.trash-notice-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.trash-notice-main svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.trash-clear-all {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--color-error);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.trash-clear-all:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
}

.trash-clear-all:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.trash-state {
  margin: 48px 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
}

.trash-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0 0 28px;
  list-style: none;
}

.trash-list-item {
  width: 100%;
  overflow: hidden;
  list-style: none;
}

.trash-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: #ffffff;
  box-shadow: var(--shadow-card);
}

.trash-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trash-card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.trash-card-tag {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font-size: 12px;
  font-weight: 600;
}

.trash-card-time {
  color: #a1a1aa;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.trash-card-preview {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-secondary-text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.trash-card-actions {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  align-self: center;
}

.trash-action-btn {
  min-width: 72px;
}

.trash-delete-btn {
  color: var(--color-error);
  border-color: rgba(220, 38, 38, 0.22);
}

.trash-delete-btn:hover:not(:disabled) {
  border-color: rgba(220, 38, 38, 0.45);
  background: rgba(220, 38, 38, 0.06);
  color: var(--color-error);
}

@media (max-width: 720px) {
  .trash-panel {
    padding-top: 16px;
  }

  .trash-notice {
    flex-direction: column;
    align-items: stretch;
  }

  .trash-clear-all {
    align-self: flex-end;
  }

  .trash-card {
    flex-direction: column;
  }

  .trash-card-actions {
    flex-direction: row;
    align-self: stretch;
    width: 100%;
  }

  .trash-action-btn,
  .trash-delete-btn {
    flex: 1;
  }
}
</style>
