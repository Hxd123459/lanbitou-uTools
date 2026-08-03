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
            <span class="sediment-template-modal-label">类型</span>
            <div class="sediment-template-kind-row" role="radiogroup" aria-label="模板类型">
              <button
                type="button"
                class="sediment-template-kind-btn"
                :class="{ 'is-active': form.kind === 'article' }"
                :disabled="isEdit"
                @click="form.kind = 'article'"
              >
                <motion.span
                  v-if="form.kind === 'article'"
                  layout-id="sedimentTemplateKind"
                  class="sediment-template-kind-active-bg"
                  :transition="kindLayoutTransition"
                />
                <span class="sediment-template-kind-label">文章</span>
              </button>
              <button
                type="button"
                class="sediment-template-kind-btn"
                :class="{ 'is-active': form.kind === 'todo' }"
                :disabled="isEdit"
                @click="form.kind = 'todo'"
              >
                <motion.span
                  v-if="form.kind === 'todo'"
                  layout-id="sedimentTemplateKind"
                  class="sediment-template-kind-active-bg"
                  :transition="kindLayoutTransition"
                />
                <span class="sediment-template-kind-label">待办</span>
              </button>
            </div>
            <span class="sediment-template-kind-hint">
              {{ form.kind === 'todo' ? '用于待办多选操作栏，最多 4 个' : '用于沉淀整理' }}
            </span>
          </label>

          <label class="sediment-template-modal-field">
            <span class="sediment-template-modal-label">标题（最多 5 字）</span>
            <input
              ref="titleInputRef"
              v-model="form.title"
              type="text"
              class="sediment-template-modal-input"
              maxlength="5"
              placeholder="例如：日报"
              spellcheck="false"
            />
          </label>

          <div class="sediment-template-modal-field">
            <div class="sediment-template-modal-label-row">
              <span class="sediment-template-modal-label-group">
                <span class="sediment-template-modal-label">提示词</span>
                <AppTooltip :text="promptTipsText" placement="below">
                  <button
                    type="button"
                    class="sediment-template-help-btn"
                    aria-label="提示词编写指引"
                    tabindex="-1"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
                      <path
                        d="M5.8 6.1a2.2 2.2 0 0 1 4.2.8c0 1.2-1.1 1.7-1.7 2.1-.4.3-.6.5-.6 1"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                      />
                      <circle cx="8" cy="12" r="0.85" fill="currentColor" />
                    </svg>
                  </button>
                </AppTooltip>
              </span>
              <button
                v-if="!isEdit && form.kind === 'article'"
                type="button"
                class="sediment-template-example-btn"
                @click="applyTodosExample"
              >
                填入待办示例
              </button>
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

          <div v-if="form.kind === 'article'" class="sediment-template-modal-field">
            <div class="sediment-template-modal-label-row">
              <span class="sediment-template-modal-label-group">
                <span class="sediment-template-modal-label">本模板行为</span>
                <AppTooltip text="仅对使用本模板整理时生效" placement="below">
                  <button
                    type="button"
                    class="sediment-template-help-btn"
                    aria-label="本模板行为说明"
                    tabindex="-1"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
                      <path
                        d="M8 4.6v5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                      />
                      <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
                    </svg>
                  </button>
                </AppTooltip>
              </span>
            </div>

            <div class="sediment-template-option">
              <label class="sediment-template-toggle-row">
                <span class="sediment-template-toggle-text">
                  <span class="sediment-template-toggle-title">模仿我的文风</span>
                </span>
                <span class="sediment-template-switch" :class="{ 'is-on': form.mimicWritingStyle }">
                  <input
                    v-model="form.mimicWritingStyle"
                    type="checkbox"
                    class="sediment-template-switch-input"
                    aria-label="模仿我的文风"
                  />
                  <span class="sediment-template-switch-track" aria-hidden="true">
                    <span class="sediment-template-switch-thumb" />
                  </span>
                </span>
              </label>
            </div>

            <div class="sediment-template-option">
              <label class="sediment-template-toggle-row">
                <span class="sediment-template-toggle-text">
                  <span class="sediment-template-toggle-title">整理后去 AI 味</span>
                </span>
                <span class="sediment-template-switch" :class="{ 'is-on': form.humanizeDraft }">
                  <input
                    v-model="form.humanizeDraft"
                    type="checkbox"
                    class="sediment-template-switch-input"
                    aria-label="整理后去 AI 味"
                  />
                  <span class="sediment-template-switch-track" aria-hidden="true">
                    <span class="sediment-template-switch-thumb" />
                  </span>
                </span>
              </label>
            </div>
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
import AppTooltip from '../common/AppTooltip.vue'
import {
  SEDIMENT_TEMPLATE_EXAMPLES,
  SEDIMENT_TEMPLATE_INSTRUCTION_PLACEHOLDER,
  SEDIMENT_TEMPLATE_PROMPT_TIPS,
} from '../../constants/sedimentTemplateGuide'
import {
  TEMPLATE_KIND_ARTICLE,
  TEMPLATE_KIND_TODO,
  TEMPLATE_TITLE_MAX,
} from '../../storage/utools/sedimentTemplates'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  initial: {
    type: Object,
    default: () => ({ title: '', instruction: '', kind: TEMPLATE_KIND_ARTICLE }),
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'submit'])

const { presets } = useMotionPresets()
const kindLayoutTransition = computed(() => presets.layoutSpring)

const titleInputRef = ref(null)
const form = ref({
  title: '',
  instruction: '',
  kind: TEMPLATE_KIND_ARTICLE,
  mimicWritingStyle: true,
  humanizeDraft: true,
})
const errorText = ref('')
const instructionPlaceholder = SEDIMENT_TEMPLATE_INSTRUCTION_PLACEHOLDER
const promptTipsText = [
  '怎么写更稳定？',
  ...SEDIMENT_TEMPLATE_PROMPT_TIPS.map((tip, index) => `${index + 1}. ${tip}`),
].join('\n')

const isEdit = computed(() => Boolean(props.initial?.id))

watch(
  () => [props.visible, props.initial],
  async ([visible]) => {
    if (!visible) {
      errorText.value = ''
      return
    }
    form.value = {
      title: String(props.initial?.title || '').slice(0, TEMPLATE_TITLE_MAX),
      instruction: String(props.initial?.instruction || ''),
      kind: props.initial?.kind === TEMPLATE_KIND_TODO
        ? TEMPLATE_KIND_TODO
        : TEMPLATE_KIND_ARTICLE,
      mimicWritingStyle: props.initial?.mimicWritingStyle !== false,
      humanizeDraft: props.initial?.humanizeDraft !== false,
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
    ...form.value,
    kind: TEMPLATE_KIND_ARTICLE,
    title: String(example.title || '').slice(0, TEMPLATE_TITLE_MAX),
    instruction: example.instruction,
    mimicWritingStyle: true,
    humanizeDraft: false,
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
  if (title.length > TEMPLATE_TITLE_MAX) {
    errorText.value = `模板名称最多 ${TEMPLATE_TITLE_MAX} 个字`
    return
  }
  errorText.value = ''
  emit('submit', {
    title,
    instruction,
    kind: form.value.kind === TEMPLATE_KIND_TODO ? TEMPLATE_KIND_TODO : TEMPLATE_KIND_ARTICLE,
    mimicWritingStyle: form.value.kind === TEMPLATE_KIND_TODO
      ? false
      : form.value.mimicWritingStyle === true,
    humanizeDraft: form.value.kind === TEMPLATE_KIND_TODO
      ? false
      : form.value.humanizeDraft === true,
  })
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

.sediment-template-kind-row {
  display: inline-flex;
  gap: 6px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.05);
}

.sediment-template-kind-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  z-index: 0;
}

.sediment-template-kind-btn.is-active {
  color: var(--color-primary);
  font-weight: 600;
}

.sediment-template-kind-active-bg {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.08);
  z-index: -1;
}

.sediment-template-kind-label {
  position: relative;
  z-index: 1;
}

.sediment-template-kind-btn:disabled {
  cursor: default;
  opacity: 0.85;
}

.sediment-template-kind-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.sediment-template-modal-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.sediment-template-modal-label-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
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

.sediment-template-help-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: help;
}

.sediment-template-help-btn:hover {
  color: var(--color-primary);
  background: rgba(24, 24, 27, 0.06);
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

.sediment-template-option + .sediment-template-option {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}

.sediment-template-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.sediment-template-toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sediment-template-toggle-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.sediment-template-switch {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}

.sediment-template-switch-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.sediment-template-switch-track {
  position: relative;
  display: block;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: #d4d4d8;
  cursor: pointer;
  transition: background 0.2s ease;
}

.sediment-template-switch.is-on .sediment-template-switch-track {
  background: #18181b;
}

.sediment-template-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease;
}

.sediment-template-switch.is-on .sediment-template-switch-thumb {
  transform: translateX(18px);
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
