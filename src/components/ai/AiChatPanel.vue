<template>
  <motion.section
    class="ai-chat-panel"
    aria-label="AI 对话"
    :initial="panelMotion.initial"
    :animate="panelMotion.animate"
    :transition="panelMotion.transition"
  >
    <div ref="messageListRef" class="ai-chat-messages">
      <div v-if="!messages.length && !streaming" class="ai-chat-empty">
        <div class="ai-chat-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3c5 0 9 3.6 9 8s-4 8-9 8c-.9 0-1.8-.1-2.6-.3L3 21l1.8-4.2A7.7 7.7 0 0 1 3 11c0-4.4 4-8 9-8z" />
            <path d="M9.5 11h.01M14.5 11h.01" />
          </svg>
        </div>
        <p class="ai-chat-empty-title">问我关于你的笔记</p>
        <div class="ai-chat-empty-hint">
          <p>可直接提问，例如「我记过哪些关于 Vue 的内容？」</p>
          <p>也可用 <kbd>@</kbd> 手动引用碎片。</p>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          v-for="msg in messages"
          :key="msg.id"
          class="ai-chat-bubble-wrap"
          :class="`is-${msg.role}`"
          layout
          :initial="presets.reveal.initial"
          :animate="presets.reveal.animate"
          :exit="presets.listItemExit"
        >
          <div v-if="msg.role === 'assistant'" class="ai-chat-bubble is-assistant">
            <span class="ai-chat-bubble-role">AI</span>
            <div class="ai-chat-bubble-md">
              <TiptapPreview :content="msg.content" :show-fallback="false" />
            </div>
          </div>
          <div v-else class="ai-chat-bubble is-user">
            <span class="ai-chat-bubble-role">你</span>
            <div
              v-if="msg.attachedNotes?.length"
              class="ai-chat-attached-notes"
            >
              <span
                v-for="note in msg.attachedNotes"
                :key="note.id"
                class="note-chip note-chip--readonly"
              >
                @{{ noteChipLabel(note) }}
              </span>
            </div>
            <p class="ai-chat-bubble-content">{{ msg.content }}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.div
        v-if="streaming"
        class="ai-chat-bubble-wrap is-assistant"
        :initial="presets.reveal.initial"
        :animate="presets.reveal.animate"
      >
        <div class="ai-chat-bubble is-assistant">
          <span class="ai-chat-bubble-role">AI</span>
          <div v-if="streamingContent" class="ai-chat-bubble-md">
            <TiptapPreview :content="streamingContent" :show-fallback="false" />
          </div>
          <span v-else class="ai-chat-typing" aria-label="AI 正在输入">
            <span /><span /><span />
          </span>
        </div>
      </motion.div>
    </div>

    <div class="ai-chat-input-area">
      <div v-if="messages.length" class="ai-chat-toolbar">
        <motion.button
          type="button"
          class="ai-chat-clear"
          :disabled="streaming"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="clearMessages"
        >
          清空对话
        </motion.button>
      </div>

      <p v-if="errorMsg" class="ai-chat-error" role="alert">{{ errorMsg }}</p>

      <div class="ai-chat-input-shell" :class="{ 'is-streaming': streaming }">
        <div v-if="selectedNotes.length" class="ai-chat-note-chips-wrap">
          <div class="ai-chat-chips-head">
            <span class="ai-chat-chips-count">已选 {{ selectedNotes.length }} 条碎片</span>
            <motion.button
              v-if="selectedNotes.length > 1"
              type="button"
              class="ai-chat-chips-clear-all"
              :disabled="streaming"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="clearSelectedNotes"
            >
              全部移除
            </motion.button>
          </div>
          <div class="ai-chat-note-chips" :class="{ 'is-scrollable': selectedNotes.length > 4 }">
            <AnimatePresence mode="popLayout">
              <motion.span
                v-for="note in selectedNotes"
                :key="note.id"
                class="note-chip"
                layout
                :initial="presets.swapLabel.initial"
                :animate="presets.swapLabel.animate"
                :exit="presets.swapLabel.exit"
                :transition="presets.swapLabel.transition"
              >
                <span class="note-chip-label">@{{ noteChipLabel(note) }}</span>
                <motion.button
                  type="button"
                  class="note-chip-remove"
                  :disabled="streaming"
                  aria-label="移除引用"
                  :while-hover="presets.button.hover"
                  :while-tap="presets.button.tap"
                  :transition="presets.button.transition"
                  @click="removeSelectedNote(note.id)"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      stroke-width="2.2"
                      stroke-linecap="round"
                      fill="none"
                    />
                  </svg>
                </motion.button>
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div class="ai-chat-input-row">
          <textarea
            ref="inputRef"
            v-model="inputValue"
            class="ai-chat-input"
            placeholder="输入指令，使用 @ 引用碎片…"
            rows="1"
            :disabled="streaming"
            :style="{ height: inputHeight + 'px' }"
            @input="onInput"
            @keydown="onKeydown"
            @blur="onTextareaBlur"
            @click="onCaretChange"
            @keyup="onCaretChange"
          />
          <motion.button
            type="button"
            class="ai-chat-send"
            :disabled="!canSend"
            :while-hover="canSend ? presets.button.hover : undefined"
            :while-tap="canSend ? presets.button.tap : undefined"
            :transition="presets.button.transition"
            aria-label="发送"
            @click="handleSend"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 7-7v4h7v6h-7v4z" transform="rotate(90 12 12)" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="noteMenuOpen"
        class="struct-note-slash-menu note-at-picker-menu"
        data-note-at-menu
        role="listbox"
        aria-label="选择碎片"
        :style="noteMenuStyle"
        @mousedown="onNoteMenuMouseDown"
      >
        <p v-if="noteMenuLoading" class="note-at-menu-state">加载碎片中…</p>
        <p v-else-if="!noteMenuItems.length" class="note-at-menu-state">
          未找到匹配的碎片
        </p>
        <button
          v-for="(item, index) in noteMenuItems"
          :key="item.noteId"
          type="button"
          class="struct-note-slash-menu__item note-at-menu-item"
          :class="{ 'struct-note-slash-menu__item--active': index === noteMenuIndex }"
          role="option"
          :aria-selected="index === noteMenuIndex"
          @click="applyNoteMenuItem(item)"
        >
          <div class="note-at-menu-meta" :class="{ 'is-tagless': !item.tag }">
            <span v-if="item.tag" class="note-at-menu-tag">{{ item.tag }}</span>
            <span class="note-at-menu-time">{{ item.time }}</span>
          </div>
          <span class="note-at-menu-preview">{{ item.preview }}</span>
        </button>
      </div>
    </Teleport>
  </motion.section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useNoteAtPicker, noteTagLabel } from '../../composables/useNoteAtPicker'
import { sendChatMessage } from '../../ai/chatService'
import TiptapPreview from '../common/TiptapPreview.vue'
import '../../assets/styles/tiptap-slash-menu.css'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const { presets } = useMotionPresets()

const panelMotion = computed(() => ({
  initial: presets.value.reveal.initial,
  animate: presets.value.reveal.animate,
  transition: presets.value.reveal.transition,
}))

let msgId = 0
const messages = ref([])
const selectedNotes = ref([])
const inputValue = ref('')
const inputHeight = ref(44)
const inputRef = ref(null)
const messageListRef = ref(null)
const streaming = ref(false)
const streamingContent = ref('')
const errorMsg = ref('')
let cancelStream = null

const {
  menuOpen: noteMenuOpen,
  menuStyle: noteMenuStyle,
  selectedIndex: noteMenuIndex,
  filteredItems: noteMenuItems,
  notesLoading: noteMenuLoading,
  syncMenu: syncNoteMenu,
  applyItem: applyNoteMenuItem,
  handleKeyDown: handleNoteMenuKeyDown,
  onMenuMouseDown: onNoteMenuMouseDown,
  onTextareaBlur,
} = useNoteAtPicker({
  getText: () => inputValue.value,
  setText: (value) => { inputValue.value = value },
  getTextarea: () => inputRef.value,
  getExcludedIds: () => selectedNotes.value.map((n) => n.id),
  onNoteSelected: (note) => {
    if (!selectedNotes.value.some((n) => n.id === note.id)) {
      selectedNotes.value = [...selectedNotes.value, note]
    }
  },
})

const canSend = computed(
  () => (inputValue.value.trim().length > 0 || selectedNotes.value.length > 0) && !streaming.value,
)

function noteChipLabel(note) {
  const tag = noteTagLabel(note)
  if (tag) return tag
  const text = String(note.text || note.summary || '').trim()
  return text ? text.slice(0, 16) + (text.length > 16 ? '…' : '') : '无标题'
}

function clearSelectedNotes() {
  selectedNotes.value = []
}

function attachNotes(notes) {
  if (!Array.isArray(notes) || !notes.length) return
  const seen = new Set(selectedNotes.value.map((n) => n.id))
  const next = [...selectedNotes.value]
  for (const note of notes) {
    if (note?.id && !seen.has(note.id)) {
      seen.add(note.id)
      next.push(note)
    }
  }
  selectedNotes.value = next
  nextTick(() => inputRef.value?.focus())
}

function resizeInput() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(Math.max(el.scrollHeight, 44), 160)
  inputHeight.value = next
  el.style.height = `${next}px`
}

function onInput() {
  nextTick(() => {
    resizeInput()
    syncNoteMenu()
  })
}

function onCaretChange() {
  nextTick(() => syncNoteMenu())
}

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function removeSelectedNote(id) {
  selectedNotes.value = selectedNotes.value.filter((n) => n.id !== id)
}

function clearMessages() {
  if (streaming.value) return
  messages.value = []
  selectedNotes.value = []
  errorMsg.value = ''
}

function buildMessageWithNotes(text, notes) {
  if (!notes.length) return text
  const context = notes
    .map((note, i) => {
      const title = noteChipLabel(note)
      const body = String(note.text || note.summary || note.markdownContent || '').trim()
      return `【碎片${i + 1}: ${title}】\n${body}`
    })
    .join('\n\n')
  return `${text}\n\n---\n引用碎片：\n${context}`
}

function handleSend() {
  const text = inputValue.value.trim()
  if ((!text && !selectedNotes.value.length) || streaming.value) return

  const attached = [...selectedNotes.value]
  const displayText = text || '请处理以上引用的碎片'

  errorMsg.value = ''
  messages.value.push({
    id: ++msgId,
    role: 'user',
    content: displayText,
    attachedNotes: attached,
  })
  inputValue.value = ''
  selectedNotes.value = []
  inputHeight.value = 44
  scrollToBottom()

  streaming.value = true
  streamingContent.value = ''

  const history = messages.value.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.attachedNotes?.length
      ? buildMessageWithNotes(m.content, m.attachedNotes)
      : m.content,
  }))

  const userMessage = buildMessageWithNotes(displayText, attached)

  cancelStream = sendChatMessage({
    history,
    userMessage,
    onDelta: (chunk) => {
      streamingContent.value += chunk
      scrollToBottom()
    },
    onDone: () => {
      if (streamingContent.value) {
        messages.value.push({
          id: ++msgId,
          role: 'assistant',
          content: streamingContent.value,
        })
      }
      streaming.value = false
      streamingContent.value = ''
      cancelStream = null
      scrollToBottom()
    },
    onError: (error) => {
      streaming.value = false
      streamingContent.value = ''
      cancelStream = null
      errorMsg.value = error?.message || '对话失败，请稍后重试'
    },
  })
}

function onKeydown(event) {
  if (handleNoteMenuKeyDown(event)) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) {
      nextTick(() => inputRef.value?.focus())
    }
  },
)

onBeforeUnmount(() => {
  cancelStream?.()
})

defineExpose({ attachNotes })
</script>

<style scoped>
.ai-chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.ai-chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 2px 16px;
}

.ai-chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  text-align: center;
}

.ai-chat-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-secondary-text);
  box-shadow: var(--shadow-card);
  margin-bottom: 4px;
}

.ai-chat-empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.ai-chat-empty-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-secondary-text);
}

.ai-chat-empty-hint p {
  margin: 0;
}

.ai-chat-empty-hint kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-family: inherit;
  font-size: 12px;
  color: var(--color-primary);
}

.ai-chat-bubble-wrap {
  display: flex;
}

.ai-chat-bubble-wrap.is-user {
  justify-content: flex-end;
}

.ai-chat-bubble-wrap.is-assistant {
  justify-content: flex-start;
}

.ai-chat-bubble-wrap.is-assistant {
  justify-content: flex-start;
}

.ai-chat-assistant-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  max-width: 85%;
}

.ai-chat-sediment-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--btn-radius);
  background: var(--color-surface);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.04);
}

.ai-chat-sediment-btn:hover:not(:disabled) {
  color: var(--color-primary);
  border-color: rgba(24, 24, 27, 0.22);
  background: rgba(24, 24, 27, 0.03);
}

.ai-chat-sediment-btn:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.ai-chat-sediment-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ai-chat-bubble {
  max-width: 85%;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.ai-chat-bubble.is-user {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  border-bottom-right-radius: 4px;
}

.ai-chat-bubble.is-assistant {
  background: var(--color-surface);
  color: var(--color-text);
  border-bottom-left-radius: 4px;
}

.ai-chat-bubble-role {
  display: block;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.65;
  margin-bottom: 4px;
}

.ai-chat-attached-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.ai-chat-bubble-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-chat-bubble-md {
  min-width: 0;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.ai-chat-bubble-md :deep(.tiptap-content .ProseMirror) {
  font-size: 14px;
  line-height: 1.6;
  color: inherit;
}

.ai-chat-bubble-md :deep(.tiptap-content .ProseMirror > :first-child) {
  margin-top: 0;
}

.ai-chat-bubble-md :deep(.tiptap-content .ProseMirror > :last-child) {
  margin-bottom: 0;
}

.ai-chat-bubble-md :deep(.tiptap-content .ProseMirror pre) {
  max-width: 100%;
  overflow-x: auto;
}

.note-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  line-height: 1.3;
}

.ai-chat-input-shell .note-chip {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
}

.note-chip--readonly {
  background: rgba(255, 255, 255, 0.14);
  color: inherit;
}

.note-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.note-chip-remove {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
}

.note-chip-remove:hover:not(:disabled) {
  opacity: 1;
  background: rgba(24, 24, 27, 0.08);
}

.ai-chat-typing {
  display: inline-flex;
  gap: 4px;
  padding: 4px 0;
}

.ai-chat-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-secondary-text);
  opacity: 0.4;
  animation: typing-pulse 1.2s ease-in-out infinite;
}

.ai-chat-typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.ai-chat-typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
  40% { opacity: 1; transform: scale(1); }
}

.ai-chat-input-area {
  flex: 0 0 auto;
  padding-bottom: 36px;
}

.ai-chat-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.ai-chat-clear {
  padding: 4px 10px;
  border: 0;
  border-radius: var(--btn-radius);
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.ai-chat-clear:hover:not(:disabled) {
  color: var(--color-primary);
  background: rgba(24, 24, 27, 0.04);
}

.ai-chat-clear:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.ai-chat-error {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-error);
}

.ai-chat-input-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.ai-chat-input-shell.is-streaming {
  opacity: 0.85;
}

.ai-chat-note-chips-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-chat-chips-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ai-chat-chips-count {
  font-size: 12px;
  color: var(--color-secondary-text);
}

.ai-chat-chips-clear-all {
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.ai-chat-chips-clear-all:hover:not(:disabled) {
  color: var(--color-primary);
  background: rgba(24, 24, 27, 0.06);
}

.ai-chat-chips-clear-all:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.ai-chat-note-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-chat-note-chips.is-scrollable {
  max-height: 88px;
  overflow-y: auto;
  padding-right: 2px;
}

.ai-chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.ai-chat-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  resize: none;
  outline: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-primary);
}

.ai-chat-input::placeholder {
  color: #a1a1aa;
}

.ai-chat-input:disabled {
  cursor: not-allowed;
}

.ai-chat-send {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: var(--btn-radius);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  cursor: pointer;
  box-shadow: var(--btn-primary-shadow);
}

.ai-chat-send:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
  box-shadow: none;
}

.ai-chat-send:not(:disabled):hover {
  background: var(--btn-primary-bg-hover);
}

.note-at-menu-state {
  margin: 0;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--color-secondary-text);
}

:global(.note-at-picker-menu) {
  min-width: 392px;
  max-width: min(520px, calc(100vw - 16px));
  padding-top: 10px;
  padding-bottom: 10px;
}

:global(.note-at-menu-item) {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 10px 12px;
}

:global(.note-at-menu-meta) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

:global(.note-at-menu-tag) {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.note-at-menu-time) {
  flex: 0 0 auto;
  margin-left: auto;
  font-size: 12px;
  color: var(--color-secondary-text);
  line-height: 1.3;
  white-space: nowrap;
}

:global(.note-at-menu-meta.is-tagless .note-at-menu-time) {
  margin-left: 0;
}

:global(.note-at-menu-preview) {
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-secondary-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
</style>
