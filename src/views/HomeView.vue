<template>
  <MainFrame>
    <template #content>
      <FadeSwap :active-key="mode">
        <template #note>
          <NoteTimeline
            :groups="assistantStore.groupedNotes"
            @copy="handleCopyNote"
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
  <CopyToast :visible="showToast" :text="toastText" />
</template>

<script setup>
import { ref } from 'vue'
import CopyToast from '../components/feedback/CopyToast.vue'
import FloatingInputBar from '../components/input/FloatingInputBar.vue'
import MainFrame from '../components/layout/MainFrame.vue'
import NoteTimeline from '../components/note/NoteTimeline.vue'
import QAList from '../components/qa/QAList.vue'
import FadeSwap from '../components/transition/FadeSwap.vue'
import { useCopyNote } from '../composables/useCopyNote'
import { useTabMode } from '../composables/useTabMode'
import { useAssistantStore } from '../stores/assistantStore'

const inputValue = ref('')
const { mode } = useTabMode('note')
const assistantStore = useAssistantStore()
const { showToast, toastText, copyText } = useCopyNote()

const handleSubmit = (text) => {
  if (mode.value === 'ask') {
    assistantStore.addQARecord(text)
    inputValue.value = ''
    return
  }
  assistantStore.addNote(text)
  inputValue.value = ''
}

const handleCopyNote = (text) => {
  copyText(text)
}
</script>


