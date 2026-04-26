import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createBlock,
  fetchBlockListByDate,
  formatDateParam,
  shiftDateString,
} from '../api/block'

const DAY_MS = 24 * 60 * 60 * 1000

function parseDateTime(value) {
  if (value instanceof Date) return value
  if (typeof value !== 'string') return new Date(value)
  const normalized = value.replace(
    /\.(\d{3})\d*/,
    (_, milliseconds) => `.${milliseconds}`,
  )
  return new Date(normalized)
}

function formatDateLabel(date) {
  const today = new Date()
  const d = parseDateTime(date)
  const dayDelta = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
      new Date(d.getFullYear(), d.getMonth(), d.getDate())) /
      DAY_MS,
  )

  if (dayDelta === 0) return '今天'
  if (dayDelta === 1) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function formatDateKey(date) {
  const d = parseDateTime(date)
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export const useAssistantStore = defineStore('assistant', () => {
  const notes = ref([])
  const noteIdSet = ref(new Set())
  const loadingNotes = ref(false)
  const loadingMoreNotes = ref(false)
  const nextDateCursor = ref(formatDateParam(new Date()))

  const groupedNotes = computed(() => {
    const map = new Map()
    notes.value.forEach((note) => {
      const key = formatDateKey(note.createdAt)
      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          label: formatDateLabel(note.createdAt),
          items: [],
        })
      }
      map.get(key).items.push(note)
    })

    return Array.from(map.values()).sort((a, b) =>
      a.dateKey > b.dateKey ? -1 : 1,
    )
  })

  const appendNotes = (list) => {
    const next = []
    list.forEach((item) => {
      if (!item?.id || noteIdSet.value.has(item.id)) return
      noteIdSet.value.add(item.id)
      next.push(item)
    })
    if (!next.length) return
    notes.value = [...notes.value, ...next]
  }

  const loadNotesByDate = async (currentDate, isInitial) => {
    if (isInitial) {
      loadingNotes.value = true
    } else {
      if (loadingMoreNotes.value) return
      loadingMoreNotes.value = true
    }

    try {
      const list = await fetchBlockListByDate(currentDate)
      appendNotes(list)
      const baseDate = currentDate || formatDateParam(new Date())
      nextDateCursor.value = shiftDateString(baseDate, -1)
    } finally {
      loadingNotes.value = false
      loadingMoreNotes.value = false
    }
  }

  const loadInitialNotes = async () => {
    notes.value = []
    noteIdSet.value = new Set()
    nextDateCursor.value = formatDateParam(new Date())
    await loadNotesByDate(undefined, true)
  }

  const loadMoreNotes = async () => {
    await loadNotesByDate(nextDateCursor.value, false)
  }

  const addNote = async (text) => {
    const id = await createBlock(text)
    if (!id || noteIdSet.value.has(id)) return id

    noteIdSet.value.add(id)
    notes.value.unshift({
      id,
      text,
      createdAt: new Date().toISOString(),
    })
    return id
  }

  const qaRecords = ref([
    {
      id: 'qa1',
      question: '今天重点做什么？',
      answer: '今天重点是先完成首页布局与输入交互，保证记录体验顺畅。',
      createdAt: new Date().toISOString(),
    },
  ])

  const createQARecord = (question) => {
    const record = {
      id: `qa_${Date.now()}`,
      question,
      answer: '',
      createdAt: new Date().toISOString(),
      isStreaming: true,
    }
    qaRecords.value.unshift(record)
    return qaRecords.value[0]
  }

  const appendQARecordAnswer = (recordId, chunk) => {
    if (!recordId || !chunk) return
    const target = qaRecords.value.find((item) => item.id === recordId)
    if (!target) return
    target.answer += chunk
  }

  const finishQARecord = (record, fallbackAnswer = '已收到请求，但暂无回答内容。') => {
    if (!record) return
    if (!record.answer.trim()) {
      record.answer = fallbackAnswer
    }
    record.isStreaming = false
  }

  return {
    notes,
    groupedNotes,
    loadingNotes,
    loadingMoreNotes,
    qaRecords,
    addNote,
    loadInitialNotes,
    loadMoreNotes,
    createQARecord,
    appendQARecordAnswer,
    finishQARecord,
  }
})
