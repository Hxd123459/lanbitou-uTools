import { computed, nextTick, ref } from 'vue'
import { fetchNotesByIds } from '../api/note'
import {
  generateSedimentDraft,
  getIntroduceMethodLabel,
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

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function useStructNoteFragmentInsert({
  draftContent,
  localFragmentNotes,
  insertedFragmentIds,
  introducedFragmentMethods,
  introducedAttachments,
  contentEditorRef,
  onAiUnavailable,
  onError,
}) {
  const selectedInsertPreset = ref(null)
  const aiProcessing = ref(false)
  const processingFragmentId = ref('')
  const aiElapsedMs = ref(0)
  const aiProgressCurrent = ref(0)
  const aiProgressTotal = ref(0)
  const aiComposingPreview = ref('')
  const aiComposingMethod = ref('')
  let cancelInsert = null
  let elapsedTimer = null
  let processingStartedAt = 0
  let userStopped = false

  const aiElapsedLabel = computed(() => formatElapsed(aiElapsedMs.value))

  const aiComposingLabel = computed(() => {
    const method = aiComposingMethod.value
    if (!method) return 'AI 整理中'
    return `AI 整理中 · ${getIntroduceMethodLabel(method)}`
  })

  const aiProgressLabel = computed(() => {
    const total = aiProgressTotal.value
    const current = aiProgressCurrent.value
    if (!total) return ''
    if (total <= 1) return '正在整理…'
    return `${current}/${total} 条碎片 · 正在整合成文…`
  })

  const clearElapsedTimer = () => {
    if (elapsedTimer != null) {
      window.clearInterval(elapsedTimer)
      elapsedTimer = null
    }
  }

  const startElapsedTimer = () => {
    clearElapsedTimer()
    processingStartedAt = Date.now()
    aiElapsedMs.value = 0
    elapsedTimer = window.setInterval(() => {
      aiElapsedMs.value = Date.now() - processingStartedAt
    }, 250)
  }

  const resetComposingState = () => {
    clearElapsedTimer()
    aiElapsedMs.value = 0
    aiProgressCurrent.value = 0
    aiProgressTotal.value = 0
    aiComposingPreview.value = ''
    aiComposingMethod.value = ''
    processingFragmentId.value = ''
  }

  const stopInsertProcessing = ({ userInitiated = false } = {}) => {
    if (userInitiated) userStopped = true
    cancelInsert?.()
    cancelInsert = null
    aiProcessing.value = false
    resetComposingState()
  }

  const markFragmentIntroduced = (fragmentId, method, note) => {
    const key = String(fragmentId)
    if (!key) return
    insertedFragmentIds.value = new Set([...insertedFragmentIds.value, key])
    introducedFragmentMethods.value = {
      ...introducedFragmentMethods.value,
      [key]: method || FRAGMENT_INTRO_RAW,
    }
    if (note) introducedAttachments?.addFromFragment?.(note)
  }

  const markFragmentsIntroduced = (fragments, method) => {
    for (const note of fragments) {
      markFragmentIntroduced(note?.id, method, note)
    }
  }

  const beginAiSession = ({ method, total, currentFragmentId = '' }) => {
    userStopped = false
    cancelInsert?.()
    aiProcessing.value = true
    aiComposingMethod.value = method || ''
    aiProgressTotal.value = total
    aiProgressCurrent.value = Math.min(1, total)
    aiComposingPreview.value = ''
    processingFragmentId.value = currentFragmentId ? String(currentFragmentId) : ''
    startElapsedTimer()
  }

  const runAiForFragments = (fragments, { onDelta } = {}) =>
    new Promise((resolve, reject) => {
      if (!fragments.length) {
        resolve('')
        return
      }

      let settled = false
      const settle = (fn, value) => {
        if (settled) return
        settled = true
        fn(value)
      }

      const innerCancel = generateSedimentDraft({
        fragments,
        preset: selectedInsertPreset.value || 'compose',
        mode: 'fragment',
        onDelta: (_chunk, accumulated) => {
          if (settled) return
          onDelta?.(accumulated)
        },
        onDone: ({ content }) => {
          settle(resolve, parseAppendContent(content || ''))
        },
        onError: (error) => {
          settle(reject, error instanceof Error ? error : new Error('AI 整理失败'))
        },
      })

      cancelInsert = () => {
        innerCancel?.()
        settle(resolve, '')
      }
    })

  const insertFragmentRaw = (note) => {
    const fragmentId = String(note.id)
    if (insertedFragmentIds.value.has(fragmentId)) return false
    draftContent.value = appendFragmentToContent(draftContent.value, note)
    markFragmentIntroduced(fragmentId, FRAGMENT_INTRO_RAW, note)
    return true
  }

  const insertFragmentWithPreset = async (note, preset) => {
    const fragmentId = String(note?.id ?? '')
    if (!fragmentId || insertedFragmentIds.value.has(fragmentId)) return

    if (!fragmentHasAiText(note)) {
      draftContent.value = appendFragmentToContent(draftContent.value, note)
      markFragmentIntroduced(fragmentId, preset, note)
      return
    }

    beginAiSession({ method: preset, total: 1, currentFragmentId: fragmentId })
    try {
      const text = await runAiForFragments([note], {
        onDelta: (accumulated) => {
          aiComposingPreview.value = parseAppendContent(accumulated)
        },
      })
      if (userStopped) return
      draftContent.value = appendProcessedBlockToContent(draftContent.value, {
        text,
        notes: [note],
        method: preset,
      })
      markFragmentIntroduced(fragmentId, preset, note)
    } finally {
      if (!userStopped) {
        stopInsertProcessing()
      }
    }
  }

  const insertFragment = async (note) => {
    const fragmentId = String(note?.id ?? '')
    if (!fragmentId || insertedFragmentIds.value.has(fragmentId)) return
    if (aiProcessing.value) return

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

    try {
      const [resolved] = await refreshFragmentNotes([note])
      await insertFragmentWithPreset(resolved || note, preset)
      if (!userStopped) {
        await nextTick()
        contentEditorRef.value?.focus()
      }
    } catch (error) {
      stopInsertProcessing()
      if (!userStopped) {
        onError?.(error instanceof Error ? error : new Error('AI 整理失败'))
      }
    }
  }

  const insertAllFragments = async () => {
    if (aiProcessing.value) return

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

    beginAiSession({
      method: preset,
      total: pending.length,
      currentFragmentId: pending[0]?.id || '',
    })

    try {
      const resolvedNotes = await refreshFragmentNotes(pending)
      if (userStopped) return

      const textNotes = resolvedNotes.filter((note) => fragmentHasAiText(note))
      const imageOnlyNotes = resolvedNotes.filter((note) => !fragmentHasAiText(note))

      aiProgressTotal.value = Math.max(textNotes.length, 1)
      aiProgressCurrent.value = textNotes.length ? 1 : 0

      let text = ''
      if (textNotes.length) {
        // 整批一次生成，避免逐条改写再拼接导致长文割裂
        text = await runAiForFragments(textNotes, {
          onDelta: (accumulated) => {
            aiComposingPreview.value = parseAppendContent(accumulated)
            aiProgressCurrent.value = textNotes.length
          },
        })
      }
      if (userStopped) return

      if (text || imageOnlyNotes.length) {
        draftContent.value = appendProcessedBlockToContent(draftContent.value, {
          text,
          notes: resolvedNotes,
          method: preset,
        })
      }
      markFragmentsIntroduced(resolvedNotes, preset)
      await nextTick()
      contentEditorRef.value?.focus()
    } catch (error) {
      if (!userStopped) {
        onError?.(error instanceof Error ? error : new Error('AI 整理失败'))
      }
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
    aiElapsedMs,
    aiElapsedLabel,
    aiProgressCurrent,
    aiProgressTotal,
    aiProgressLabel,
    aiComposingPreview,
    aiComposingLabel,
    aiComposingMethod,
    insertFragment,
    insertAllFragments,
    stopInsertProcessing: () => stopInsertProcessing({ userInitiated: true }),
    disposeFragmentInsert,
    getPendingFragments: () =>
      getPendingFragments(localFragmentNotes.value, insertedFragmentIds.value),
  }
}
