<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="todo-add-modal"
        class="todo-add-modal"
        role="dialog"
        aria-modal="true"
        aria-label="添加待办"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.18 }"
      >
        <motion.div
          class="todo-add-modal-backdrop"
          aria-hidden="true"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          @click="handleClose"
        />

        <motion.form
          class="todo-add-modal-card"
          :initial="{ opacity: 0, y: 16, scale: 0.98 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="{ opacity: 0, y: 12, scale: 0.98 }"
          :transition="{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }"
          @submit.prevent="handleSubmit"
        >
          <div class="todo-add-modal-head">
            <h3 class="todo-add-modal-title">添加待办</h3>
            <p class="todo-add-modal-hint">可连续录入多条，最后一次加入</p>
          </div>

          <ul v-if="drafts.length" class="todo-add-draft-list" aria-label="待加入列表">
            <li v-for="(item, index) in drafts" :key="item.id" class="todo-add-draft-item">
              <span class="todo-add-draft-index">{{ index + 1 }}</span>
              <p class="todo-add-draft-text">{{ item.title }}</p>
              <button
                type="button"
                class="todo-add-draft-remove"
                :disabled="saving"
                title="移除"
                aria-label="移除这条待办"
                @click="removeDraft(index)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          </ul>

          <label class="todo-add-modal-field">
            <textarea
              ref="textareaRef"
              v-model="title"
              class="todo-add-modal-textarea"
              rows="4"
              :maxlength="MAX_TITLE_LENGTH"
              placeholder="输入待办内容…（支持换行）"
              :disabled="saving"
              spellcheck="false"
              @keydown.esc.prevent="handleClose"
              @keydown.ctrl.enter.prevent="handleAddAnother"
              @keydown.meta.enter.prevent="handleAddAnother"
            />
            <span class="todo-add-modal-count" :class="{ 'is-near': remaining <= 20 }">
              {{ title.length }}/{{ MAX_TITLE_LENGTH }}
            </span>
          </label>

          <div class="todo-add-modal-actions">
            <AppButton
              class="btn btn-icon-text todo-add-modal-btn"
              type="button"
              :disabled="saving"
              @click="handleClose"
            >
              取消
            </AppButton>
            <AppButton
              class="btn btn-icon-text todo-add-modal-btn"
              type="button"
              :disabled="saving || !canAddAnother"
              @click="handleAddAnother"
            >
              再加一条
            </AppButton>
            <AppButton
              class="btn btn-primary todo-add-modal-btn todo-add-modal-btn--submit"
              type="submit"
              :disabled="saving || !canSubmit"
            >
              {{ submitLabel }}
            </AppButton>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import AppButton from '../motion/AppButton.vue'

const MAX_TITLE_LENGTH = 240

const props = defineProps({
  visible: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'submit'])

const title = ref('')
const drafts = ref([])
const textareaRef = ref(null)
let draftSeq = 0

const remaining = computed(() => MAX_TITLE_LENGTH - String(title.value || '').length)

const currentTitle = computed(() => String(title.value || '').trim())

const canAddAnother = computed(() => currentTitle.value.length > 0)

const pendingCount = computed(() => {
  let count = drafts.value.length
  if (currentTitle.value) count += 1
  return count
})

const canSubmit = computed(() => pendingCount.value > 0)

const submitLabel = computed(() => {
  if (props.saving) return '加入中…'
  if (pendingCount.value > 1) return `全部加入（${pendingCount.value}）`
  return '加入'
})

const focusTextarea = async () => {
  await nextTick()
  textareaRef.value?.focus?.()
}

const handleClose = () => {
  if (props.saving) return
  emit('close')
}

const removeDraft = (index) => {
  drafts.value = drafts.value.filter((_, i) => i !== index)
}

const pushCurrentToDrafts = () => {
  const value = currentTitle.value
  if (!value) return false
  draftSeq += 1
  drafts.value = [...drafts.value, { id: `draft-${draftSeq}`, title: value }]
  title.value = ''
  return true
}

const handleAddAnother = async () => {
  if (!pushCurrentToDrafts()) return
  await focusTextarea()
}

const handleSubmit = () => {
  const titles = drafts.value.map((item) => item.title)
  if (currentTitle.value) titles.push(currentTitle.value)
  if (!titles.length) return
  emit('submit', titles)
}

watch(
  () => props.visible,
  async (open) => {
    if (!open) return
    title.value = ''
    drafts.value = []
    draftSeq = 0
    await focusTextarea()
  },
)
</script>

<style scoped>
.todo-add-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.todo-add-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(24, 24, 27, 0.28);
}

.todo-add-modal-card {
  position: relative;
  z-index: 1;
  width: min(460px, 100%);
  padding: 18px;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border);
  background: var(--color-surface, #fff);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.todo-add-modal-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.todo-add-modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  color: var(--color-primary);
}

.todo-add-modal-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.todo-add-draft-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
}

.todo-add-draft-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 28px;
  align-items: start;
  gap: 8px;
  padding: 8px 8px 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.02);
}

.todo-add-draft-index {
  margin-top: 1px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
}

.todo-add-draft-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.todo-add-draft-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.todo-add-draft-remove:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
  color: var(--color-error);
}

.todo-add-draft-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.todo-add-modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-add-modal-textarea {
  width: 100%;
  min-height: 108px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-primary);
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
  resize: vertical;
  box-sizing: border-box;
  white-space: pre-wrap;
}

.todo-add-modal-textarea:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.todo-add-modal-textarea:disabled {
  opacity: 0.65;
}

.todo-add-modal-count {
  align-self: flex-end;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
}

.todo-add-modal-count.is-near {
  color: #b45309;
}

.todo-add-modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.todo-add-modal-btn {
  min-width: 72px;
}

.todo-add-modal-btn--submit {
  min-width: 108px;
}
</style>
