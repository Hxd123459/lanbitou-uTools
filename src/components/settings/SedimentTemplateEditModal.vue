<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="sediment-template-edit-modal"
        class="sediment-template-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="isEdit ? '编辑整理模板' : '新增整理模板'"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.18 }"
      >
        <motion.div
          class="sediment-template-modal-backdrop"
          aria-hidden="true"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          @click="emit('close')"
        />

        <motion.form
          class="sediment-template-modal-card"
          :initial="{ opacity: 0, y: 16, scale: 0.98 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="{ opacity: 0, y: 12, scale: 0.98 }"
          :transition="{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }"
          @submit.prevent="handleSubmit"
        >
          <h3 class="sediment-template-modal-title">
            {{ isEdit ? '编辑模板' : '新增模板' }}
          </h3>

          <label class="sediment-template-modal-field">
            <span class="sediment-template-modal-label">标题</span>
            <input
              ref="titleInputRef"
              v-model="form.title"
              type="text"
              class="sediment-template-modal-input"
              maxlength="40"
              placeholder="例如：整理成待办"
              spellcheck="false"
            />
          </label>

          <div class="sediment-template-modal-field">
            <div class="sediment-template-modal-label-row">
              <span class="sediment-template-modal-label">提示词</span>
              <button
                v-if="!isEdit"
                type="button"
                class="sediment-template-example-btn"
                @click="applyTodosExample"
              >
                填入待办示例
              </button>
            </div>

            <div class="sediment-template-prompt-guide" role="note" aria-label="提示词编写指引">
              <p class="sediment-template-prompt-guide-title">怎么写更稳定？</p>
              <ul class="sediment-template-prompt-guide-list">
                <li v-for="(tip, index) in promptTips" :key="index">{{ tip }}</li>
              </ul>
            </div>

            <textarea
              v-model="form.instruction"
              class="sediment-template-modal-textarea"
              rows="8"
              maxlength="800"
              :placeholder="instructionPlaceholder"
              spellcheck="false"
            />
          </div>

          <p v-if="errorText" class="sediment-template-modal-error">{{ errorText }}</p>

          <div class="sediment-template-modal-actions">
            <button
              type="button"
              class="btn sediment-template-modal-btn"
              @click="emit('close')"
            >
              取消
            </button>
            <button
              type="submit"
              class="btn btn-primary sediment-template-modal-btn"
              :disabled="saving"
            >
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import {
  SEDIMENT_TEMPLATE_EXAMPLES,
  SEDIMENT_TEMPLATE_INSTRUCTION_PLACEHOLDER,
  SEDIMENT_TEMPLATE_PROMPT_TIPS,
} from '../../constants/sedimentTemplateGuide'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  initial: {
    type: Object,
    default: () => ({ title: '', instruction: '' }),
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'submit'])

const titleInputRef = ref(null)
const form = ref({ title: '', instruction: '' })
const errorText = ref('')
const promptTips = SEDIMENT_TEMPLATE_PROMPT_TIPS
const instructionPlaceholder = SEDIMENT_TEMPLATE_INSTRUCTION_PLACEHOLDER

const isEdit = computed(() => Boolean(props.initial?.id))

watch(
  () => [props.visible, props.initial],
  async ([visible]) => {
    if (!visible) {
      errorText.value = ''
      return
    }
    form.value = {
      title: String(props.initial?.title || ''),
      instruction: String(props.initial?.instruction || ''),
    }
    errorText.value = ''
    await nextTick()
    titleInputRef.value?.focus()
  },
  { immediate: true, deep: true },
)

const applyTodosExample = () => {
  const example = SEDIMENT_TEMPLATE_EXAMPLES.todos
  form.value = {
    title: example.title,
    instruction: example.instruction,
  }
  errorText.value = ''
}

const handleSubmit = () => {
  const title = String(form.value.title || '').trim()
  const instruction = String(form.value.instruction || '').trim()
  if (!title || !instruction) {
    errorText.value = '请填写标题和提示词'
    return
  }
  errorText.value = ''
  emit('submit', { title, instruction })
}
</script>

<style scoped>
.sediment-template-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.sediment-template-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.34);
}

.sediment-template-modal-card {
  position: relative;
  z-index: 1;
  width: min(100%, 480px);
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.sediment-template-modal-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.sediment-template-modal-field {
  display: block;
  margin-bottom: 14px;
}

.sediment-template-modal-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.sediment-template-modal-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.sediment-template-modal-label-row .sediment-template-modal-label {
  margin-bottom: 0;
}

.sediment-template-example-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.sediment-template-example-btn:hover {
  text-decoration: underline;
}

.sediment-template-prompt-guide {
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 10px;
  background: rgba(37, 99, 235, 0.04);
}

.sediment-template-prompt-guide-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}

.sediment-template-prompt-guide-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--color-secondary-text);
}

.sediment-template-prompt-guide-list li + li {
  margin-top: 2px;
}

.sediment-template-modal-input,
.sediment-template-modal-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
}

.sediment-template-modal-textarea {
  resize: vertical;
  min-height: 148px;
}

.sediment-template-modal-input:focus,
.sediment-template-modal-textarea:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.sediment-template-modal-error {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--color-error);
}

.sediment-template-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.sediment-template-modal-btn {
  min-width: 72px;
}
</style>
