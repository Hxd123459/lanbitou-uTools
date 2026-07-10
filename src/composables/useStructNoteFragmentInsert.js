import { nextTick, ref } from 'vue'
import { fetchNotesByIds } from '../api/note'
import {
  generateSedimentDraft,
  isSedimentDraftAiAvailable,
  parseAppendContent,
} from '../ai/sedimentDraftService'
import {
  FRAGMENT_INTRO_RAW,
  appendFragmentToContent,
  appendProcessedBlockToContent,
  getFragmentContent,
} from './useStructNoteFragments'

function fragmentHasAiText(note) {
  return Boolean(getFragmentContent(note).trim())
}

function getPendingFragments(fragmentNotes, insertedIds) {
  const inserted = insertedIds?.value ?? insertedIds ?? new Set()
  return (Array.isArray(fragmentNotes) ? fragmentNotes : []).filter((note) => {
    const id = note?.id
    if (!id) return false
    const key = String(id)
    return !inserted.has(key) && !inserted.has(id)
  })
}

async function refreshFragmentNotes(notes) {
  const list = Array.isArray(notes) ? notes : []
  const ids = list.map((note) => note?.id).filter(Boolean)
  if (!ids.length) return list

  try {
    const fetched = await fetchNotesByIds(ids)
    const byId = new Map(fetched.map((note) => [String(note.id), note]))
    return list.map((note) => {
      const full = byId.get(String(note?.id))
      return full ? { ...note, ...full } : note
    })
  } catch {
    return list
  }
}

export function useStructNoteFragmentInsert({
  draftContent,
  localFragmentNotes,
  insertedFragmentIds,
  introducedFragmentMethods,
  contentEditorRef,
  onAiUnavailable,
  onError,
}) {
  const selectedInsertPreset = ref(null)
  const aiProcessing = ref(false)
  const processingFragmentId = ref('')
  let cancelInsert = null

  const stopInsertProcessing = () => {
    cancelInsert?.()
    cancelInsert = null
    aiProcessing.value = false
    processingFragmentId.value = ''
  }

  const markFragmentIntroduced = (fragmentId, method) => {
    const key = String(fragmentId)
    if (!key) return
    insertedFragmentIds.value = new Set([...insertedFragmentIds.value, key])
    introducedFragmentMethods.value = {
      ...introducedFragmentMethods.value,
      [key]: method || FRAGMENT_INTRO_RAW,
    }
  }

  const runAiForFragments = (fragments) =>
    new Promise((resolve, reject) => {
      if (!fragments.length) {
        resolve('')
        return () => {}
      }

      cancelInsert = generateSedimentDraft({
        fragments,
        preset: selectedInsertPreset.value || 'compose',
        mode: 'fragment',
        onDelta: () => {},
        onDone: ({ content }) => {
          resolve(parseAppendContent(content || ''))
        },
        onError: (error) => {
          reject(error instanceof Error ? error : new Error('AI 整理失败'))
        },
      })
    })

  const insertFragmentRaw = (note) => {
    const fragmentId = String(note.id)
    if (insertedFragmentIds.value.has(fragmentId)) return false
    draftContent.value = appendFragmentToContent(draftContent.value, note)
    markFragmentIntroduced(fragmentId, FRAGMENT_INTRO_RAW)
    return true
  }

  const insertFragmentWithPreset = async (note, preset) => {
    const fragmentId = String(note?.id ?? '')
    if (!fragmentId || insertedFragmentIds.value.has(fragmentId)) return

    if (!fragmentHasAiText(note)) {
      draftContent.value = appendFragmentToContent(draftContent.value, note)
      markFragmentIntroduced(fragmentId, preset)
      return
    }

    processingFragmentId.value = fragmentId
    const text = await runAiForFragments([note])
    draftContent.value = appendProcessedBlockToContent(draftContent.value, {
      text,
      notes: [note],
      method: preset,
    })
    markFragmentIntroduced(fragmentId, preset)
  }

  const insertFragment = async (note) => {
    const fragmentId = String(note?.id ?? '')
    if (!fragmentId || insertedFragmentIds.value.has(fragmentId)) return

    const preset = selectedInsertPreset.value
    if (!preset) {
      if (insertFragmentRaw(note)) {
        await nextTick()
        contentEditorRef.value?.focus()
      }
      return
    }

    if (!isSedimentDraftAiAvailable()) {
      onAiUnavailable?.()
      return
    }

    aiProcessing.value = true
    processingFragmentId.value = fragmentId
    try {
      const [resolved] = await refreshFragmentNotes([note])
      await insertFragmentWithPreset(resolved || note, preset)
      await nextTick()
      contentEditorRef.value?.focus()
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('AI 整理失败'))
    } finally {
      stopInsertProcessing()
    }
  }

  const insertAllFragments = async () => {
    const pending = getPendingFragments(
      localFragmentNotes.value,
      insertedFragmentIds.value,
    )
    if (!pending.length) return

    const preset = selectedInsertPreset.value
    if (!preset) {
      for (const note of pending) {
        insertFragmentRaw(note)
      }
      await nextTick()
      contentEditorRef.value?.focus()
      return
    }

    if (!isSedimentDraftAiAvailable()) {
      onAiUnavailable?.()
      return
    }

    aiProcessing.value = true
    try {
      const resolvedNotes = await refreshFragmentNotes(pending)
      const textParts = []

      for (const note of resolvedNotes) {
        const fragmentId = String(note?.id ?? '')
        if (!fragmentId || insertedFragmentIds.value.has(fragmentId)) continue

        if (!fragmentHasAiText(note)) continue

        processingFragmentId.value = fragmentId
        const text = await runAiForFragments([note])
        if (text) textParts.push(text)
      }

      draftContent.value = appendProcessedBlockToContent(draftContent.value, {
        text: textParts.join('\n\n'),
        notes: resolvedNotes,
        method: preset,
      })
      for (const note of resolvedNotes) {
        markFragmentIntroduced(note.id, preset)
      }
      await nextTick()
      contentEditorRef.value?.focus()
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('AI 整理失败'))
    } finally {
      stopInsertProcessing()
    }
  }

  const disposeFragmentInsert = () => {
    stopInsertProcessing()
    selectedInsertPreset.value = null
  }

  return {
    selectedInsertPreset,
    aiProcessing,
    processingFragmentId,
    insertFragment,
    insertAllFragments,
    stopInsertProcessing,
    disposeFragmentInsert,
    getPendingFragments: () =>
      getPendingFragments(localFragmentNotes.value, insertedFragmentIds.value),
  }
}
