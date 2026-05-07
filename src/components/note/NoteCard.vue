<template>
  <article class="note-card" :class="{ 'is-editing': isEditing }">
    <div class="note-meta">
      <div class="meta-left">
        <span v-if="titleText" class="note-tag">{{ titleText }}</span>
        <span class="note-time">{{ timeText }}</span>
      </div>
      <div v-if="!note?.isPending" class="meta-actions">
        <button
          v-if="!isEditing"
          class="icon-btn"
          type="button"
          title="编辑"
          @click="enterEdit"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
        <button
          v-if="!isEditing"
          class="icon-btn icon-btn-danger"
          type="button"
          title="删除"
          @click="onDelete"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </div>
    </div>

    <template v-if="note?.isPending">
      <div class="skeleton-line w-70" />
      <div class="skeleton-line w-100" />
      <div class="skeleton-line w-85" />
    </template>

    <template v-else-if="isEditing">
      <textarea
        ref="editorRef"
        v-model="draftContent"
        class="note-editor"
        spellcheck="false"
        :disabled="saving"
        @input="autoGrow"
        @keydown="onEditorKeydown"
      />
      <div class="editor-bar">
        <span class="editor-hint">
          <kbd>{{ shortcutLabel }}</kbd>
          <span class="hint-plus">+</span>
          <kbd>Enter</kbd>
          <span class="hint-text">保存</span>
        </span>
        <div class="editor-bar-right">
          <button
            type="button"
            class="link-btn"
            :disabled="saving"
            @click="cancelEdit"
          >
            取消
          </button>
          <button
            type="button"
            class="primary-btn"
            :disabled="saving || !canSave"
            @click="saveEdit"
          >
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <MarkdownRender
        :nodes="markdownNodes"
        :typewriter="false"
        :batch-rendering="false"
        :defer-nodes-until-visible="false"
        code-block-light-theme="github-light"
        code-block-dark-theme="github-light"
        :themes="codeThemes"
      />
      <p v-if="!markdownNodes.length" class="note-text-fallback">
        {{ contentText || '（暂无内容）' }}
      </p>
    </template>
  </article>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  MarkdownRender,
  getMarkdown,
  parseMarkdownToStructure,
} from 'vue-renderer-markdown'
import { useAssistantStore } from '../../stores/assistantStore'

const props = defineProps({
  note: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['edit-save', 'delete'])

const assistantStore = useAssistantStore()

const draftContent = ref('')
const saving = ref(false)
const editorRef = ref(null)
const isMac = ref(false)

const codeThemes = { light: 'github-light', dark: 'github-light' }

const isEditing = computed(
  () => assistantStore.editingNoteId === props.note?.id,
)

const shortcutLabel = computed(() => (isMac.value ? '⌘' : 'Ctrl'))

const contentText = computed(
  () => props.note?.updateContent || props.note?.text || '',
)
const titleText = computed(() => props.note?.title || '')
const timeText = computed(() => formatTime(props.note?.createdAt))
const canSave = computed(
  () =>
    draftContent.value.trim().length > 0 &&
    draftContent.value !== contentText.value,
)

const md = getMarkdown('note-card')
const markdownNodes = computed(() => {
  const text = contentText.value
  if (!text) return []
  try {
    return parseMarkdownToStructure(text, md)
  } catch (error) {
    console.error('[NoteCard] parse markdown failed:', error)
    return []
  }
})

const enterEdit = async () => {
  draftContent.value = contentText.value
  assistantStore.setEditingNoteId(props.note.id)
  await nextTick()
  autoGrow()
  editorRef.value?.focus()
}

const cancelEdit = () => {
  if (saving.value) return
  draftContent.value = ''
  if (assistantStore.editingNoteId === props.note.id) {
    assistantStore.setEditingNoteId(null)
  }
}

const autoGrow = () => {
  const el = editorRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 480)}px`
}

const onEditorKeydown = (event) => {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
    return
  }
  if (event.key === 'Enter') {
    const modifierPressed = isMac.value ? event.metaKey : event.ctrlKey
    if (modifierPressed) {
      event.preventDefault()
      saveEdit()
    }
  }
}

const saveEdit = async () => {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    await Promise.resolve(
      emit('edit-save', { id: props.note.id, content: draftContent.value }),
    )
    draftContent.value = ''
    if (assistantStore.editingNoteId === props.note.id) {
      assistantStore.setEditingNoteId(null)
    }
  } finally {
    saving.value = false
  }
}

const onDelete = () => {
  emit('delete', { id: props.note.id })
}

watch(
  () => assistantStore.editingNoteId,
  (newId) => {
    if (newId !== props.note.id && draftContent.value) {
      draftContent.value = ''
    }
  },
)

onMounted(() => {
  const platform =
    (typeof navigator !== 'undefined' &&
      (navigator.userAgentData?.platform || navigator.platform || '')) ||
    ''
  isMac.value = /Mac|iPhone|iPad|iPod/i.test(platform)
})

function formatTime(dateValue) {
  if (!dateValue) return '----'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '----'
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}
</script>

<style scoped>
.note-card {
  position: relative;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition: border-color var(--motion-fast),
    box-shadow var(--motion-fast);
}

.note-card:hover {
  border-color: #d4d4d8;
  box-shadow: 0 4px 14px rgba(24, 24, 27, 0.08);
}

.note-card.is-editing {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.note-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.meta-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.note-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.note-time {
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.meta-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transform: translateY(-1px);
  transition: opacity var(--motion-fast), transform var(--motion-fast);
}

.note-card:hover .meta-actions,
.note-card:focus-within .meta-actions,
.note-card.is-editing .meta-actions {
  opacity: 1;
  transform: translateY(0);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
  transition: background var(--motion-fast), color var(--motion-fast),
    border-color var(--motion-fast);
}

.icon-btn:hover {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-text);
}

.icon-btn-danger:hover {
  background: rgba(220, 38, 38, 0.08);
  color: var(--color-error);
}

.note-card :deep(p) {
  margin: 0;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.note-text-fallback {
  margin: 0;
  color: var(--color-secondary-text);
  font-size: 13px;
}

/* === Markdown 代码块：白色主题 + 隐藏工具栏 === */
.note-card :deep(.code-action-btn),
.note-card :deep(.copy-button) {
  display: none !important;
}

.note-card :deep(.monaco-editor),
.note-card :deep(.monaco-editor-background),
.note-card :deep(.monaco-editor .margin),
.note-card :deep(.monaco-editor .lines-content),
.note-card :deep(.monaco-editor .view-overlays),
.note-card :deep(.monaco-editor .overflow-guard),
.note-card :deep(.monaco-diff-editor),
.note-card :deep(pre[class*="language-"]),
.note-card :deep(pre.shiki) {
  background: #fafafa !important;
}

.note-card :deep(pre.shiki),
.note-card :deep(pre[class*="language-"]) {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
}

.note-card :deep(pre.shiki *),
.note-card :deep(pre[class*="language-"] *) {
  background: transparent !important;
}

.note-card :deep(.monaco-editor) {
  border-radius: 8px;
}

/* === 编辑器：无装饰原地编辑 === */
.note-editor {
  display: block;
  width: 100%;
  min-height: 60px;
  max-height: 480px;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  resize: none;
  overflow-y: auto;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  scrollbar-width: thin;
}

.note-editor:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.editor-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--color-border);
}

.editor-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-secondary-text);
  font-size: 11px;
}

.editor-hint kbd {
  display: inline-block;
  min-width: 22px;
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}

.hint-plus {
  color: #a1a1aa;
}

.hint-text {
  margin-left: 2px;
}

.editor-bar-right {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.link-btn {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-secondary-text);
  font-size: 13px;
  cursor: pointer;
  transition: color var(--motion-fast);
}

.link-btn:hover:not(:disabled) {
  color: var(--color-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-btn {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  background: var(--color-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--motion-fast), border-color var(--motion-fast),
    opacity var(--motion-fast);
}

.primary-btn:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* === 骨架屏 === */
.skeleton-line {
  height: 12px;
  border-radius: 6px;
  margin-top: 8px;
  background: linear-gradient(90deg, #ececf0 25%, #f5f5f7 37%, #ececf0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.3s ease infinite;
}

.w-70 {
  width: 70%;
}

.w-85 {
  width: 85%;
}

.w-100 {
  width: 100%;
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
