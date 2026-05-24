<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="struct-note-view"
        class="note-view-modal"
        role="dialog"
        aria-modal="true"
        :initial="{ opacity: 0, y: 28 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: 28 }"
        :transition="{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }"
      >
        <!-- 左上角关闭 -->
        <motion.button
          type="button"
          class="note-view-close"
          aria-label="关闭"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="emitClose"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </motion.button>

        <!-- 右上角操作区 -->
        <div class="note-view-actions">
          <AnimatePresence mode="wait">
            <!-- 编辑模式：保存 + 取消 -->
            <motion.div
              v-if="editing"
              key="edit-actions"
              class="note-view-action-group"
              :initial="{ opacity: 0, x: 8 }"
              :animate="{ opacity: 1, x: 0 }"
              :exit="{ opacity: 0, x: 8 }"
              :transition="{ duration: 0.16, ease: 'easeOut' }"
            >
              <motion.button
                type="button"
                class="btn btn-icon-text note-view-cancel-btn"
                :disabled="saving"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="cancelEdit"
              >
                取消
              </motion.button>
              <motion.button
                type="button"
                class="btn btn-primary"
                :disabled="saving || !canSave"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="handleSave"
              >
                {{ saving ? '保存中…' : '保存' }}
              </motion.button>
            </motion.div>

            <!-- 预览模式：编辑按钮 -->
            <motion.button
              v-else
              key="edit-trigger"
              type="button"
              class="btn btn-icon-text"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="enterEdit"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              编辑
            </motion.button>
          </AnimatePresence>
        </div>

        <!-- 内容区 -->
        <div class="note-view-body">
          <p v-if="loadError" class="note-view-error">加载失败，请稍后重试</p>

          <template v-else>
            <!-- 标题 -->
            <input
              v-if="editing"
              ref="titleInputRef"
              v-model="draftTitle"
              class="note-view-title-input"
              type="text"
              maxlength="80"
              placeholder="请输入标题"
              spellcheck="false"
              :disabled="saving"
            />
            <h1 v-else class="note-view-title">{{ note.title || note.name }}</h1>

            <!-- 分隔线 -->
            <div class="note-view-divider" />

            <!-- 正文 -->
            <textarea
              v-if="editing"
              v-model="draftContent"
              class="note-view-textarea"
              placeholder="开始写作…"
              spellcheck="false"
              :disabled="saving"
            />
            <div v-else-if="fetching" class="note-view-loading">加载中…</div>
            <div v-else class="note-view-content">{{ note.content || '暂无内容' }}</div>
          </template>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { getStructNote, updateStructNote } from '../../api/structNote'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  visible: { type: Boolean, default: false },
  noteItem: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const { presets } = useMotionPresets()

const note = ref({ title: '', name: '', content: '' })
const fetching = ref(false)
const loadError = ref(false)
const editing = ref(false)
const saving = ref(false)
const draftTitle = ref('')
const draftContent = ref('')
const titleInputRef = ref(null)

const canSave = computed(() => draftTitle.value.trim().length > 0)

const fetchDetail = async () => {
  if (!props.noteItem) return
  fetching.value = true
  loadError.value = false
  try {
    const data = await getStructNote(props.noteItem.noteId ?? props.noteItem.id)
    note.value = { ...props.noteItem, ...data }
  } catch {
    loadError.value = true
    note.value = { ...props.noteItem, content: '' }
  } finally {
    fetching.value = false
  }
}

const enterEdit = async () => {
  draftTitle.value = note.value.title || note.value.name || ''
  draftContent.value = note.value.content || ''
  editing.value = true
  await nextTick()
  titleInputRef.value?.focus()
}

const cancelEdit = () => {
  if (saving.value) return
  editing.value = false
}

const handleSave = async () => {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    await updateStructNote({
      id: props.noteItem.noteId ?? props.noteItem.id,
      title: draftTitle.value.trim(),
      content: draftContent.value.trim(),
    })
    note.value = { ...note.value, title: draftTitle.value.trim(), name: draftTitle.value.trim(), content: draftContent.value.trim() }
    editing.value = false
    emit('saved')
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

const emitClose = () => {
  if (saving.value) return
  emit('close')
}

const onKeydown = (e) => {
  if (!props.visible || saving.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (editing.value) cancelEdit()
    else emitClose()
  }
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      editing.value = false
      note.value = { ...props.noteItem, content: '' }
      fetchDetail()
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.note-view-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: #fbfaf9;
}

.note-view-close {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
  cursor: pointer;
}

.note-view-close:hover {
  background: rgba(24, 24, 27, 0.1);
}

.note-view-actions {
  position: absolute;
  top: 21px;
  right: 18px;
  z-index: 2;
  display: flex;
  align-items: center;
}

.note-view-action-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.note-view-cancel-btn {
  color: var(--color-secondary-text);
}

.note-view-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 80px 24px 32px;
  box-sizing: border-box;
  overflow-y: auto;
}

.note-view-title {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 600;
  color: var(--color-primary);
  line-height: 1.25;
  word-break: break-word;
}

.note-view-title-input {
  flex: 0 0 auto;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 28px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: inherit;
  padding: 0;
  margin-bottom: 0;
  caret-color: var(--color-accent);
}

.note-view-title-input::placeholder {
  color: #d1d5db;
}

.note-view-divider {
  height: 1px;
  background: rgba(24, 24, 27, 0.07);
  margin: 18px 0 20px;
  flex: 0 0 auto;
}

.note-view-content {
  flex: 1;
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.note-view-textarea {
  flex: 1;
  min-height: 320px;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text);
  resize: none;
  padding: 0;
  caret-color: var(--color-accent);
}

.note-view-textarea::placeholder {
  color: #d1d5db;
}

.note-view-loading,
.note-view-error {
  font-size: 14px;
  color: var(--color-secondary-text);
  margin: 0;
}

.note-view-error {
  color: #ef4444;
}
</style>
