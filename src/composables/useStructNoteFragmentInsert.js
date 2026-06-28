import { nextTick, ref } from 'vue'
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

function fragmentsNeedAiText(fragments) {
  return fragments.some((note) => fragmentHasAiText(note))
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
        existingContent: draftContent.value.trim(),
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

    if (!fragmentHasAiText(note)) {
      draftContent.value = appendFragmentToContent(draftContent.value, note)
      markFragmentIntroduced(fragmentId, preset)
      await nextTick()
      contentEditorRef.value?.setMarkdownContent?.(draftContent.value, { emitUpdate: true })
      contentEditorRef.value?.focus()
      return
    }

    if (!isSedimentDraftAiAvailable()) {
      onAiUnavailable?.()
      return
    }

    aiProcessing.value = true
    processingFragmentId.value = fragmentId
    try {
      const text = await runAiForFragments([note])
      draftContent.value = appendProcessedBlockToContent(draftContent.value, {
        text,
        notes: [note],
        method: preset,
      })
      markFragmentIntroduced(fragmentId, preset)
      await nextTick()
      contentEditorRef.value?.setMarkdownContent?.(draftContent.value, { emitUpdate: true })
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
      const aiFragments = fragmentsNeedAiText(pending)
        ? pending.filter((note) => fragmentHasAiText(note))
        : []
      const text = aiFragments.length ? await runAiForFragments(aiFragments) : ''
      draftContent.value = appendProcessedBlockToContent(draftContent.value, {
        text,
        notes: pending,
        method: preset,
      })
      for (const note of pending) {
        markFragmentIntroduced(note.id, preset)
      }
      await nextTick()
      contentEditorRef.value?.setMarkdownContent?.(draftContent.value, { emitUpdate: true })
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
