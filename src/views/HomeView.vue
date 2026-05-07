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
        @edit-save="handleEditSave"
        @delete="handleDelete"
      />
    </template>
  </MainFrame>

  <CopyToast
    :visible="showToast"
    :text="toastText"
    :type="toastType"
    :action-label="toastActionLabel"
    @action="triggerToastAction"
  />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CopyToast from '../components/feedback/CopyToast.vue'
import FloatingInputBar from '../components/input/FloatingInputBar.vue'
import MainFrame from '../components/layout/MainFrame.vue'
import NoteTimeline from '../components/note/NoteTimeline.vue'
import { useCopyNote } from '../composables/useCopyNote'
import { ApiError } from '../api/http'
import { deleteBlock } from '../api/block'
import { useAssistantStore } from '../stores/assistantStore'

const inputValue = ref('')
const noteSubmitting = ref(false)
const assistantStore = useAssistantStore()
const {
  showToast,
  toastText,
  toastType,
  toastActionLabel,
  openToast,
  triggerToastAction,
} = useCopyNote()

const deleteTimers = new Map()

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

const handleEditSave = async ({ id, content }) => {
  try {
    await assistantStore.updateNote(id, content)
    openToast('已保存修改', 'success')
  } catch (error) {
    notifyError(error)
    throw error
  }
}

const handleDelete = ({ id }) => {
  if (deleteTimers.has(id)) return

  if (assistantStore.editingNoteId === id) {
    assistantStore.setEditingNoteId(null)
  }
  assistantStore.setNotePendingDelete(id, true)

  const timer = window.setTimeout(async () => {
    deleteTimers.delete(id)
    try {
      await deleteBlock(id)
      assistantStore.removeNoteLocal(id)
    } catch (error) {
      assistantStore.setNotePendingDelete(id, false)
      notifyError(error)
    }
  }, 3000)

  deleteTimers.set(id, timer)

  openToast('笔记已删除', 'success', {
    duration: 3000,
    actionLabel: '撤销',
    onAction: () => {
      const t = deleteTimers.get(id)
      if (t) {
        clearTimeout(t)
        deleteTimers.delete(id)
      }
      assistantStore.setNotePendingDelete(id, false)
    },
  })
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

onBeforeUnmount(() => {
  deleteTimers.forEach((timer) => clearTimeout(timer))
  deleteTimers.clear()
})
</script>
