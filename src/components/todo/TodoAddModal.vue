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
          @click="emit('close')"
        />

        <motion.form
          class="todo-add-modal-card"
          :initial="{ opacity: 0, y: 16, scale: 0.98 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="{ opacity: 0, y: 12, scale: 0.98 }"
          :transition="{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }"
          @submit.prevent="handleSubmit"
        >
          <h3 class="todo-add-modal-title">待办内容</h3>

          <label class="todo-add-modal-field">
            <textarea
              ref="textareaRef"
              v-model="title"
              class="todo-add-modal-textarea"
              rows="5"
              :maxlength="MAX_TITLE_LENGTH"
              placeholder="输入待办内容…"
              :disabled="saving"
              spellcheck="false"
              @keydown.esc.prevent="emit('close')"
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
              @click="emit('close')"
            >
              取消
            </AppButton>
            <AppButton
              class="btn btn-primary todo-add-modal-btn"
              type="submit"
              :disabled="saving || !canSubmit"
            >
              {{ saving ? '添加中…' : '添加' }}
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
const textareaRef = ref(null)

const canSubmit = computed(() => String(title.value || '').trim().length > 0)
const remaining = computed(() => MAX_TITLE_LENGTH - String(title.value || '').length)

const handleSubmit = () => {
  const value = String(title.value || '').trim()
  if (!value) return
  emit('submit', value)
}

watch(
  () => props.visible,
  async (open) => {
    if (!open) return
    title.value = ''
    await nextTick()
    textareaRef.value?.focus?.()
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
  width: min(420px, 100%);
  padding: 18px;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border);
  background: var(--color-surface, #fff);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.todo-add-modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  color: var(--color-primary);
}

.todo-add-modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-add-modal-textarea {
  width: 100%;
  min-height: 120px;
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
  gap: 8px;
}

.todo-add-modal-btn {
  min-width: 72px;
}
</style>
