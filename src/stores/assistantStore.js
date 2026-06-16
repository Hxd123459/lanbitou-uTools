import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createBlock,
  deleteBlock,
  fetchNoteList,
  mapBlockResources,
  NOTE_LIST_PAGE_SIZE,
  setPinBlock,
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
  const loadingMoreNotes = ref(false)
  const hasMoreNotes = ref(true)
  const currentPageNo = ref(0)
  const editingNoteId = ref(null)
  let loadToken = 0

  const visibleNotes = computed(() =>
    notes.value
      .filter((note) => !note.pendingDelete)
      .slice()
      .sort((a, b) => {
        const pinDiff = pinRank(a.pinWeightType) - pinRank(b.pinWeightType)
        if (pinDiff !== 0) return pinDiff
        return String(b.createdAt || b.createTime || '').localeCompare(
          String(a.createdAt || a.createTime || ''),
        )
      }),
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

  const loadNotes = async ({ reset = false, force = false } = {}) => {
    if (!force && (loadingNotes.value || loadingMoreNotes.value)) return
    if (!reset && !hasMoreNotes.value) return

    const pageNo = reset ? 1 : currentPageNo.value + 1
    const myToken = reset ? ++loadToken : loadToken
    if (reset) {
      loadingNotes.value = true
    } else {
      loadingMoreNotes.value = true
    }

    try {
      const result = await fetchNoteList({
        pageNo,
        pageSize: NOTE_LIST_PAGE_SIZE,
      })
      if (reset && myToken !== loadToken) return
      if (reset) {
        notes.value = result.list
        noteIdSet.value = new Set(
          result.list.map((item) => item.id).filter(Boolean),
        )
      } else {
        appendNotes(result.list)
      }
      currentPageNo.value = result.pageNo
      hasMoreNotes.value = result.hasMore
    } finally {
      if (!reset || myToken === loadToken) {
        loadingNotes.value = false
        loadingMoreNotes.value = false
      }
    }
  }

  const reloadNotes = async () => {
    loadingNotes.value = false
    loadingMoreNotes.value = false
    currentPageNo.value = 0
    hasMoreNotes.value = true
    await loadNotes({ reset: true, force: true })
  }

  const loadInitialNotes = async () => {
    await reloadNotes()
  }

  const insertRestoredNote = (note) => {
    if (!note?.id || noteIdSet.value.has(note.id)) return
    noteIdSet.value.add(note.id)
    const normalized = {
      ...note,
      pendingDelete: false,
      createdAt: note.createdAt || note.createTime || '',
    }
    notes.value = [normalized, ...notes.value.filter((item) => item.id !== note.id)]
  }

  const loadMoreNotes = async () => {
    await loadNotes({ reset: false })
  }

  const addNote = async (
    text,
    images = [],
    onProgress,
    { tagId, tagName, resolveTagName } = {},
  ) => {
    const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const pendingNote = {
      id: pendingId,
      title: tagName || '',
      tagId: tagId || null,
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
      let resolvedTagId = tagId
      let resolvedTagName = String(tagName ?? '').trim()
      if (
        typeof resolveTagName === 'function' &&
        !resolvedTagId &&
        !resolvedTagName &&
        String(text ?? '').trim()
      ) {
        try {
          const aiTag = await resolveTagName(text)
          if (aiTag) {
            resolvedTagName = aiTag
            const target = notes.value.find((item) => item.id === pendingId)
            if (target) target.title = aiTag
          }
        } catch (error) {
          console.warn('[烂笔头] AI 自动打标失败', error)
        }
      }

      const result = await createBlock(text, images, onProgress, {
        tagId: resolvedTagId,
        tagName: resolvedTagName,
      })
      const target = notes.value.find((item) => item.id === pendingId)
      if (!target) return result
      const data =
        result && typeof result === 'object' ? result : { title: result }
      const finalId = data.id ?? pendingId
      target.id = finalId
      target.title = data.title || ''
      target.tagId = data.tagId ?? resolvedTagId ?? null
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

  const updateNote = async (id, title, content, imageOptions = {}) => {
    const sid = String(id)
    const target = notes.value.find((item) => String(item.id) === sid)
    const { retainedImageIds, newImages, onProgress, tagId, tagName } =
      imageOptions
    const result = await updateBlock(id, title, content, {
      tagId,
      tagName,
      retainedImageIds,
      newImages,
      onProgress,
    })
    const data = result && typeof result === 'object' ? result : null
    if (!target) return data

    target.text = data?.content || content
    target.markdownContent = data?.content || content
    const resolvedTitle =
      data?.title !== undefined && data?.title !== null
        ? data.title
        : tagName !== undefined
          ? tagName
          : title
    target.title = resolvedTitle
    if (data?.tagId !== undefined) {
      target.tagId = data.tagId
    } else if (tagId !== undefined) {
      target.tagId = tagId
    }
    if (Array.isArray(data?.blocks)) {
      target.images = mapBlockResources(data.blocks)
    }
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
    loadingMoreNotes,
    hasMoreNotes,
    editingNoteId,
    addNote,
    updateNote,
    removeNote,
    setPinNote,
    loadInitialNotes,
    loadMoreNotes,
    reloadNotes,
    insertRestoredNote,
    setEditingNoteId,
    setNotePendingDelete,
    removeNoteLocal,
  }
})
