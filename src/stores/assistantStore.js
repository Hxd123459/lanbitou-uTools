import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createBlock,
  deleteBlock,
  fetchBlockListByDate,
  formatDateParam,
  mapBlockResources,
  setPinBlock,
  shiftDateString,
  updateBlock,
} from '../api/note'

const PIN_WEIGHT = { TOP: 0, DEFAULT: 1, BOTTOM: 2 }

function pinRank(type) {
  return PIN_WEIGHT[type] ?? PIN_WEIGHT.DEFAULT
}

export const useAssistantStore = defineStore('assistant', () => {
  const notes = ref([])
  const noteIdSet = ref(new Set())
  const loadingNotes = ref(false)
  const nextDateCursor = ref(formatDateParam(new Date()))
  const editingNoteId = ref(null)

  const visibleNotes = computed(() =>
    notes.value
      .filter((note) => !note.pendingDelete)
      .slice()
      .sort((a, b) => pinRank(a.pinWeightType) - pinRank(b.pinWeightType)),
  )

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

  const addNote = async (text, images = [], onProgress) => {
    const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const pendingNote = {
      id: pendingId,
      title: '',
      fineTitle: '',
      text,
      markdownContent: text,
      createdAt: new Date().toISOString(),
      isPending: true,
      pinWeightType: 'DEFAULT',
      images: [],
    }

    notes.value.unshift(pendingNote)

    try {
      const result = await createBlock(text, images, onProgress)
      const target = notes.value.find((item) => item.id === pendingId)
      if (!target) return result
      const data =
        result && typeof result === 'object' ? result : { title: result }
      const finalId = data.id ?? pendingId
      target.id = finalId
      target.title = data.title || ''
      target.text = data.content || text
      target.markdownContent = data.content || text
      target.images = mapBlockResources(data.blocks)
      target.isPending = false
      noteIdSet.value.add(finalId)
      return target
    } catch (error) {
      notes.value = notes.value.filter((item) => item.id !== pendingId)
      throw error
    }
  }

  const updateNote = async (id, title, content) => {
    const target = notes.value.find((item) => item.id === id)
    if (!target) return null
    const result = await updateBlock(id, title, content)
    const data = result && typeof result === 'object' ? result : null
    target.text = data?.content || content
    target.markdownContent = data?.content || content
    target.title =
      data?.title !== undefined && data?.title !== null ? data.title : title
    return target
  }

  const removeNote = async (id) => {
    await deleteBlock(id)
    notes.value = notes.value.filter((item) => item.id !== id)
    noteIdSet.value.delete(id)
  }

  const setPinNote = async (id, pinWeightValue) => {
    const target = notes.value.find((item) => item.id === id)
    if (!target) return null
    const previous = target.pinWeightType || 'DEFAULT'
    target.pinWeightType = pinWeightValue
    try {
      const result = await setPinBlock(id, pinWeightValue)
      const data = result && typeof result === 'object' ? result : null
      if (data?.pinWeightType) {
        target.pinWeightType = data.pinWeightType
      }
      return target
    } catch (error) {
      target.pinWeightType = previous
      throw error
    }
  }

  return {
    notes,
    visibleNotes,
    loadingNotes,
    editingNoteId,
    addNote,
    updateNote,
    removeNote,
    setPinNote,
    loadInitialNotes,
    setEditingNoteId,
    setNotePendingDelete,
    removeNoteLocal,
  }
})
