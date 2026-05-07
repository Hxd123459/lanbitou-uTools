<template>
  <MainFrame>
    <template #input>
      <FloatingInputBar
        v-model="inputValue"
        :submitting="noteSubmitting"
        @submit="handleSubmit"
      />
    </template>

    <template #content>
      <NoteTimeline
        :groups="assistantStore.groupedNotes"
        :loading="assistantStore.loadingNotes"
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
import { useCopyNote } from '../composables/useCopyNote'
import { ApiError } from '../api/http'
import { useAssistantStore } from '../stores/assistantStore'

const inputValue = ref('')
const noteSubmitting = ref(false)
const assistantStore = useAssistantStore()
const { showToast, toastText, toastType, openToast } = useCopyNote()

const handleSubmit = async (text) => {
  if (noteSubmitting.value) return
  noteSubmitting.value = true
  try {
    await assistantStore.addNote(text)
    inputValue.value = ''
  } catch (error) {
    notifyError(error)
  } finally {
    noteSubmitting.value = false
  }
}

const notifyError = (error) => {
  if (error instanceof ApiError) {
    openToast(`[${error.code}] ${error.msg}`, 'error')
    return
  }
  const message = error?.message || '系统异常'
  openToast(`[UNKNOWN] ${message}`, 'error')
}

onMounted(async () => {
  try {
    await assistantStore.loadInitialNotes()
  } catch (error) {
    notifyError(error)
  }
})
</script>
