import { nextTick, ref } from 'vue'
import {
  generateSedimentDraft,
  isSedimentDraftAiAvailable,
  parseAppendContent,
  parseDraftTitleAndContent,
} from '../ai/sedimentDraftService'

function getPendingFragments(fragmentNotes, insertedIds) {
  const inserted = insertedIds?.value ?? insertedIds ?? new Set()
  return (Array.isArray(fragmentNotes) ? fragmentNotes : []).filter((note) => {
    const id = note?.id
    if (!id) return false
    const key = String(id)
    return !inserted.has(key) && !inserted.has(id)
  })
}

function combineWithBase(baseContent, appendBody) {
  const base = String(baseContent ?? '').trim()
  const addition = String(appendBody ?? '').trim()
  if (!addition) return base
  return base ? `${base}\n\n${addition}` : addition
}

export function useStructNoteAiDraft({
  draftContent,
  draftTitle,
  titleTouched,
  aiDraftTitle,
  localFragmentNotes,
  insertedFragmentIds,
  insertedStatusIds,
  contentEditorRef,
  onAiUnavailable,
  onError,
}) {
  const aiGenerating = ref(false)
  const activePreset = ref('')
  let cancelDraft = null

  const stopAiDraftGeneration = () => {
    cancelDraft?.()
    cancelDraft = null
    aiGenerating.value = false
    activePreset.value = ''
  }

  const markFragmentsInserted = (fragments) => {
    const ids = fragments
      .map((note) => note?.id)
      .filter(Boolean)
    if (!ids.length) return
    insertedFragmentIds.value = new Set([...insertedFragmentIds.value, ...ids.map(String)])
  }

  const handleDraftRequest = ({ preset, customPrompt }) => {
    const pendingFragments = getPendingFragments(
      localFragmentNotes.value,
      insertedStatusIds ?? insertedFragmentIds,
    )
    if (!pendingFragments.length) {
      onError?.(new Error('没有待整理的碎片'))
      return
    }

    if (!isSedimentDraftAiAvailable()) {
      onAiUnavailable?.()
      return
    }

    const hasBody = Boolean(draftContent.value.trim())
    const mode = hasBody ? 'append' : 'generate'
    const baseContent = hasBody ? draftContent.value.trim() : ''

    cancelDraft?.()
    aiGenerating.value = true
    activePreset.value = preset || 'compose'

    if (mode === 'generate') {
      draftContent.value = ''
      contentEditorRef.value?.setMarkdownContent('', { emitUpdate: false })
    }

    let draftAccumulated = ''
    let streamRenderTimer = null

    const clearStreamTimer = () => {
      if (streamRenderTimer) {
        window.clearTimeout(streamRenderTimer)
        streamRenderTimer = null
      }
    }

    const renderStreamingDraft = (accumulated) => {
      try {
        if (mode === 'append') {
          const appendBody = parseAppendContent(accumulated)
          const combined = combineWithBase(baseContent, appendBody)
          contentEditorRef.value?.setStreamingMarkdown(combined)
          return
        }

        const { content } = parseDraftTitleAndContent(accumulated)
        const body = content || accumulated
        contentEditorRef.value?.setStreamingMarkdown(body)
      } catch (error) {
        clearStreamTimer()
        stopAiDraftGeneration()
        onError?.(error instanceof Error ? error : new Error('AI 整理渲染失败'))
      }
    }

    cancelDraft = generateSedimentDraft({
      fragments: pendingFragments,
      preset: preset || 'compose',
      customPrompt,
      mode,
      existingContent: baseContent,
      onDelta: (_chunk, accumulated) => {
        draftAccumulated = accumulated
        if (streamRenderTimer) window.clearTimeout(streamRenderTimer)
        streamRenderTimer = window.setTimeout(() => {
          renderStreamingDraft(accumulated)
          streamRenderTimer = null
        }, 80)
      },
      onTitle: (title) => {
        if (mode !== 'generate') return
        if (titleTouched?.value) return
        if (!title) return
        draftTitle.value = title
        if (aiDraftTitle) aiDraftTitle.value = title
      },
      onDone: ({ title, content }) => {
        clearStreamTimer()
        stopAiDraftGeneration()

        if (mode === 'generate') {
          if (!titleTouched?.value && title) {
            draftTitle.value = title
            if (aiDraftTitle) aiDraftTitle.value = title
          }

          const body =
            content || parseDraftTitleAndContent(draftAccumulated).content || draftAccumulated
          draftContent.value = body
        } else {
          const appendBody = content || parseAppendContent(draftAccumulated)
          const finalContent = combineWithBase(baseContent, appendBody)
          draftContent.value = finalContent
        }

        markFragmentsInserted(pendingFragments)
        nextTick(() => contentEditorRef.value?.focus())
      },
      onError: (error) => {
        clearStreamTimer()
        stopAiDraftGeneration()
        onError?.(error)
      },
    })
  }

  const disposeAiDraft = () => {
    cancelDraft?.()
    cancelDraft = null
  }

  return {
    aiGenerating,
    activePreset,
    handleDraftRequest,
    stopAiDraftGeneration,
    disposeAiDraft,
  }
}
