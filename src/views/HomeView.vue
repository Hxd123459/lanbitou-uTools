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
      <section class="note-list">
        <p
          v-if="!assistantStore.visibleNotes.length && !assistantStore.loadingNotes"
          class="empty-state"
        >
          还没有笔记，先记录一条吧。
        </p>

        <NoteCard
          v-for="note in assistantStore.visibleNotes"
          :key="note.id"
          :note="note"
          @edit-save="handleEditSave"
          @delete="handleDelete"
          @copied="handleCopied"
          @copy-failed="handleCopyFailed"
          @pin="handlePin"
        />
      </section>
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
import NoteCard from '../components/note/NoteCard.vue'
import { useCopyNote } from '../composables/useCopyNote'
import { ApiError } from '../api/http'
import { deleteBlock } from '../api/note'
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

const handleEditSave = async ({ id, title, content }) => {
  try {
    await assistantStore.updateNote(id, title, content)
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

const handlePin = async ({ id, pinWeightValue }) => {
  try {
    await assistantStore.setPinNote(id, pinWeightValue)
    const tip =
      pinWeightValue === 'TOP'
        ? '已置顶'
        : pinWeightValue === 'BOTTOM'
          ? '已置底'
          : '已取消'
    openToast(tip, 'success', { duration: 1600 })
  } catch (error) {
    notifyError(error)
  }
}

const handleCopied = () => {
  openToast('已复制纯文本', 'success', { duration: 1600 })
}

const handleCopyFailed = () => {
  openToast('复制失败', 'error', { duration: 1600 })
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

<style scoped>
.note-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 0 28px 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;

  scrollbar-width: thin;
  scrollbar-color: rgba(24, 24, 27, 0.18) transparent;
}

.note-list > * {
  width: 100%;
  max-width: var(--frame-inner-width);
  box-sizing: border-box;
}

.note-list::-webkit-scrollbar {
  width: 8px;
}

.note-list::-webkit-scrollbar-track {
  background: transparent;
}

.note-list::-webkit-scrollbar-thumb {
  background: rgba(24, 24, 27, 0.18);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.note-list::-webkit-scrollbar-thumb:hover {
  background: rgba(24, 24, 27, 0.32);
  background-clip: content-box;
}

.empty-state {
  margin: 48px 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
}
</style>
