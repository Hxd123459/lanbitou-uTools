<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="todo-generate-modal"
        class="todo-gen-modal"
        role="dialog"
        aria-modal="true"
        aria-label="生成说明"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.18 }"
      >
        <motion.div
          class="todo-gen-backdrop"
          aria-hidden="true"
          @click="emit('close')"
        />
        <motion.div
          class="todo-gen-card"
          :initial="{ opacity: 0, y: 16 }"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0, y: 12 }"
          :transition="{ duration: 0.22 }"
        >
          <header class="todo-gen-header">
            <h3>生成说明</h3>
            <p>已选 {{ todos.length }} 条待办</p>
          </header>

          <div class="todo-gen-templates" role="tablist">
            <button
              v-for="item in templates"
              :key="item.id"
              type="button"
              class="todo-gen-tpl"
              :class="{ 'is-active': template === item.id }"
              :disabled="generating"
              @click="template = item.id"
            >
              {{ item.label }}
            </button>
          </div>

          <textarea
            v-model="draft"
            class="todo-gen-textarea"
            rows="12"
            :disabled="generating"
            placeholder="生成结果会出现在这里，可继续编辑…"
          />

          <p v-if="hint" class="todo-gen-hint">{{ hint }}</p>

          <div class="todo-gen-actions">
            <button type="button" class="todo-review-btn" :disabled="generating" @click="emit('close')">
              关闭
            </button>
            <button type="button" class="todo-review-btn" :disabled="generating" @click="runGenerate">
              {{ generating ? '生成中…' : '重新生成' }}
            </button>
            <button type="button" class="todo-review-btn" :disabled="generating || !draft" @click="copyText">
              复制
            </button>
            <button
              type="button"
              class="todo-review-btn is-primary"
              :disabled="generating || !draft || !canWriteArchive"
              @click="emit('save-archive', { template, text: draft })"
            >
              写入沉淀
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import {
  generateTodoCopy,
  listCopyTemplates,
} from '../../ai/todoCopyGenerateService'

const props = defineProps({
  visible: { type: Boolean, default: false },
  project: { type: Object, default: null },
  todos: { type: Array, default: () => [] },
  runsById: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'save-archive', 'toast'])

const templates = listCopyTemplates()
const template = ref('daily')
const draft = ref('')
const generating = ref(false)
const hint = ref('')

const canWriteArchive = computed(() => Boolean(props.project?.sedimentFolderId))

const runGenerate = async () => {
  generating.value = true
  hint.value = ''
  try {
    const result = await generateTodoCopy({
      template: template.value,
      project: props.project,
      todos: props.todos,
      runsById: props.runsById,
    })
    draft.value = result.text
    hint.value = result.source === 'fallback' ? '已用规则拼接（AI 不可用或失败）' : '已由 AI 生成，可编辑后复制'
  } catch (error) {
    hint.value = error?.message || '生成失败'
  } finally {
    generating.value = false
  }
}

const copyText = async () => {
  try {
    await navigator.clipboard.writeText(draft.value)
    emit('toast', '已复制')
  } catch {
    emit('toast', '复制失败')
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    template.value = 'daily'
    draft.value = ''
    void runGenerate()
  },
)

watch(template, () => {
  if (props.visible) void runGenerate()
})
</script>

<style scoped>
.todo-gen-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.todo-gen-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(24, 24, 27, 0.28);
}

.todo-gen-card {
  position: relative;
  z-index: 1;
  width: min(560px, 100%);
  padding: 18px;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border);
  background: var(--color-surface, #fff);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.todo-gen-header h3 {
  margin: 0;
  font-size: 16px;
}

.todo-gen-header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.todo-gen-templates {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.todo-gen-tpl {
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.todo-gen-tpl.is-active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.todo-gen-textarea {
  width: 100%;
  min-height: 220px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
  resize: vertical;
}

.todo-gen-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.todo-gen-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.todo-review-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.todo-review-btn.is-primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.todo-review-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
