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
          <QAList :items="assistantStore.qaRecords" />
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
import { useCopyNote } from '../composables/useCopyNote'
import { useTabMode } from '../composables/useTabMode'
import { ApiError } from '../api/http'
import { useAssistantStore } from '../stores/assistantStore'

const inputValue = ref('')
const { mode } = useTabMode('note')
const assistantStore = useAssistantStore()
const { showToast, toastText, toastType, openToast, copyText } = useCopyNote()

const handleSubmit = async (text) => {
  if (mode.value === 'ask') {
    try {
      await assistantStore.addQARecord(text)
      inputValue.value = ''
    } catch (error) {
      notifyError(error)
    }
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
  openToast('[UNKNOWN] 系统异常', 'error')
}

const handleLoadMore = async () => {
  try {
    await assistantStore.loadMoreNotes()
  } catch (error) {
    notifyError(error)
  }
}

onMounted(async () => {
  try {
    await assistantStore.loadInitialNotes()
  } catch (error) {
    notifyError(error)
  }
})
</script>


