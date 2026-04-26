<template>
  <MainFrame>
    <template #content>
      <FadeSwap :active-key="mode">
        <template #note>
          <NoteTimeline
            :groups="assistantStore.groupedNotes"
            :loading="assistantStore.loadingMoreNotes"
            @copy="handleCopyNote"
            @load-more="handleLoadMore"
          />
        </template>
        <template #ask>
          <div class="qa-panel">
            <div class="qa-toolbar">
              <button
                v-if="chatLoading"
                class="stop-btn"
                type="button"
                @click="handleStopAsk"
              >
                停止回答
              </button>
            </div>
            <QAList :items="assistantStore.qaRecords" />
          </div>
        </template>
      </FadeSwap>
    </template>

    <template #input>
      <FloatingInputBar
        v-model:mode="mode"
        v-model="inputValue"
        @submit="handleSubmit"
      />
    </template>
  </MainFrame>
  <CopyToast :visible="showToast" :text="toastText" :type="toastType" />
</template>

<script setup>
import { onMounted, ref } from 'vue'
import CopyToast from '../components/feedback/CopyToast.vue'
import FloatingInputBar from '../components/input/FloatingInputBar.vue'
import MainFrame from '../components/layout/MainFrame.vue'
import NoteTimeline from '../components/note/NoteTimeline.vue'
import QAList from '../components/qa/QAList.vue'
import FadeSwap from '../components/transition/FadeSwap.vue'
import { useChatStream } from '../composables/useChatStream'
import { useCopyNote } from '../composables/useCopyNote'
import { useTabMode } from '../composables/useTabMode'
import { ApiError } from '../api/http'
import { useAssistantStore } from '../stores/assistantStore'

const inputValue = ref('')
const streamingRecord = ref(null)
const typingBuffer = ref('')
const typingTimer = ref(null)
const streamEnded = ref(false)
const { mode } = useTabMode('note')
const assistantStore = useAssistantStore()
const { showToast, toastText, toastType, openToast, copyText } = useCopyNote()
const { loading: chatLoading, startStream, stopStream } = useChatStream()

const stopTypingTimer = () => {
  if (typingTimer.value) {
    clearInterval(typingTimer.value)
    typingTimer.value = null
  }
}

const finishStreamingRecord = (record, fallbackAnswer) => {
  if (!record) return
  assistantStore.finishQARecord(record, fallbackAnswer)
  streamingRecord.value = null
  typingBuffer.value = ''
  streamEnded.value = false
  stopTypingTimer()
}

const startTypingEffect = (record) => {
  if (typingTimer.value || !record?.id) return
  typingTimer.value = setInterval(() => {
    if (!streamingRecord.value || streamingRecord.value.id !== record.id) {
      stopTypingTimer()
      return
    }
    if (!typingBuffer.value) {
      if (streamEnded.value) {
        finishStreamingRecord(record)
      }
      return
    }
    const nextChar = typingBuffer.value[0]
    typingBuffer.value = typingBuffer.value.slice(1)
    assistantStore.appendQARecordAnswer(record.id, nextChar)
  }, 24)
}

const handleSubmit = async (text) => {
  if (mode.value === 'ask') {
    if (streamingRecord.value?.isStreaming) {
      stopStream()
      finishStreamingRecord(streamingRecord.value, '回答已停止。')
    }
    const record = assistantStore.createQARecord(text)
    streamingRecord.value = record
    typingBuffer.value = ''
    streamEnded.value = false
    inputValue.value = ''
    startStream(text, {
      onChunk: (chunk) => {
        typingBuffer.value += chunk
        startTypingEffect(record)
      },
      onEnd: () => {
        streamEnded.value = true
        if (!typingBuffer.value) {
          finishStreamingRecord(record)
        }
      },
      onError: (error) => {
        finishStreamingRecord(record, '回答中断，请重试。')
        notifyError(error)
      },
    })
    return
  }
  try {
    await assistantStore.addNote(text)
    inputValue.value = ''
  } catch (error) {
    notifyError(error)
  }
}

const handleCopyNote = (text) => {
  copyText(text)
}

const notifyError = (error) => {
  if (error instanceof ApiError) {
    openToast(`[${error.code}] ${error.msg}`, 'error')
    return
  }
  const message = error?.message || '系统异常'
  openToast(`[UNKNOWN] ${message}`, 'error')
}

const handleLoadMore = async () => {
  try {
    await assistantStore.loadMoreNotes()
  } catch (error) {
    notifyError(error)
  }
}

const handleStopAsk = () => {
  stopStream()
  if (streamingRecord.value?.isStreaming) {
    finishStreamingRecord(streamingRecord.value, '回答已停止。')
  }
  openToast('已停止回答', 'error')
}

onMounted(async () => {
  try {
    await assistantStore.loadInitialNotes()
  } catch (error) {
    notifyError(error)
  }
})
</script>

<style scoped>
.qa-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qa-toolbar {
  display: flex;
  justify-content: flex-end;
}

.stop-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-secondary-text);
  font-size: 12px;
  cursor: pointer;
}
</style>


