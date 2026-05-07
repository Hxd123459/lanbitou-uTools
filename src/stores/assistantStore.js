import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createBlock,
  deleteBlock,
  fetchBlockListByDate,
  formatDateParam,
  shiftDateString,
  updateBlock,
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
  const nextDateCursor = ref(formatDateParam(new Date()))
  const editingNoteId = ref(null)

  const groupedNotes = computed(() => {
    const map = new Map()
    notes.value.forEach((note) => {
      if (note.pendingDelete) return
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

  const setEditingNoteId = (id) => {
    editingNoteId.value = id || null
  }

  const setNotePendingDelete = (id, value) => {
    const target = notes.value.find((item) => item.id === id)
    if (target) target.pendingDelete = !!value
  }

  const removeNoteLocal = (id) => {
    notes.value = notes.value.filter((item) => item.id !== id)
    noteIdSet.value.delete(id)
  }

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
    if (!isInitial) return
    loadingNotes.value = true

    try {
      const list = await fetchBlockListByDate(currentDate)
      appendNotes(list)
      const baseDate = currentDate || formatDateParam(new Date())
      nextDateCursor.value = shiftDateString(baseDate, -1)
    } finally {
      loadingNotes.value = false
    }
  }

  const loadInitialNotes = async () => {
    notes.value = []
    noteIdSet.value = new Set()
    nextDateCursor.value = formatDateParam(new Date())
    await loadNotesByDate(undefined, true)
  }

  const addNote = async (text) => {
    const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const pendingNote = {
      id: pendingId,
      title: '',
      fineTitle: '',
      text,
      updateContent: text,
      createdAt: new Date().toISOString(),
      isPending: true,
    }

    notes.value.unshift(pendingNote)

    try {
      const result = await createBlock(text)
      const target = notes.value.find((item) => item.id === pendingId)
      if (!target) return result
      const data =
        result && typeof result === 'object' ? result : { title: result }
      const finalId = data.id ?? pendingId
      target.id = finalId
      target.title = data.title || ''
      target.text = data.content || text
      target.updateContent = data.content || text
      target.isPending = false
      noteIdSet.value.add(finalId)
      return target
    } catch (error) {
      notes.value = notes.value.filter((item) => item.id !== pendingId)
      throw error
    }
  }

  const updateNote = async (id, content) => {
    const target = notes.value.find((item) => item.id === id)
    if (!target) return null
    const result = await updateBlock(id, content)
    const data =
      result && typeof result === 'object' ? result : null
    target.text = data?.content || content
    target.updateContent = data?.content || content
    if (data?.title !== undefined && data?.title !== null) {
      target.title = data.title
    }
    return target
  }

  const removeNote = async (id) => {
    await deleteBlock(id)
    notes.value = notes.value.filter((item) => item.id !== id)
    noteIdSet.value.delete(id)
  }

  return {
    notes,
    groupedNotes,
    loadingNotes,
    editingNoteId,
    addNote,
    updateNote,
    removeNote,
    loadInitialNotes,
    setEditingNoteId,
    setNotePendingDelete,
    removeNoteLocal,
  }
})
