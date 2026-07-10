import { ref } from 'vue'
import { resolveResourceUrl } from '../api/http'
import { buildAttachmentId, getAttachmentBlobUrl } from '../storage/utools/attachment'
import { isUtoolsMode } from '../storage/env'
import { getAttachmentKind, getAttachmentName } from '../utils/attachmentDisplay'
import { getFragmentAttachments } from './useStructNoteFragments'

export function createIntroducedAttachmentKey(fragmentId, attachmentId) {
  return `${fragmentId}_${attachmentId}`
}

export function resolveFragmentAttachmentUrl(fragmentId, attachment) {
  const attachmentId = attachment?.attachmentId || buildAttachmentId(fragmentId, attachment?.id)
  if (isUtoolsMode() && attachment?.id) {
    return getAttachmentBlobUrl(attachmentId) || ''
  }
  const url = attachment?.url || attachment?.fileUrl || ''
  return url ? resolveResourceUrl(url) : ''
}

export function mapFragmentAttachmentsToItems(note) {
  const fragmentId = String(note?.id ?? '')
  if (!fragmentId) return []

  return getFragmentAttachments(note)
    .map((attachment, idx) => {
      const attachmentId = String(attachment?.id ?? idx)
      const kind = getAttachmentKind(attachment)
      const name = getAttachmentName(attachment, kind === 'image' ? '图片' : '附件')
      const url = resolveFragmentAttachmentUrl(fragmentId, attachment)
      return {
        key: createIntroducedAttachmentKey(fragmentId, attachmentId),
        fragmentId,
        attachmentId,
        kind,
        name,
        url,
      }
    })
    .filter((item) => item.url || item.kind === 'file')
}

export function useIntroducedFragmentAttachments() {
  const items = ref([])

  const addFromFragment = (note) => {
    const incoming = mapFragmentAttachmentsToItems(note)
    if (!incoming.length) return
    const existing = new Set(items.value.map((item) => item.key))
    for (const item of incoming) {
      if (!existing.has(item.key)) {
        items.value.push(item)
        existing.add(item.key)
      }
    }
  }

  const addFromFragments = (notes = []) => {
    for (const note of notes) addFromFragment(note)
  }

  const removeByKey = (key) => {
    items.value = items.value.filter((item) => item.key !== key)
  }

  const removeByFragmentIds = (fragmentIds = []) => {
    const idSet = new Set(
      (Array.isArray(fragmentIds) ? fragmentIds : String(fragmentIds ?? '').split(','))
        .map((id) => String(id).trim())
        .filter(Boolean),
    )
    if (!idSet.size) return
    items.value = items.value.filter((item) => !idSet.has(item.fragmentId))
  }

  const reset = () => {
    items.value = []
  }

  const setItems = (list = []) => {
    items.value = Array.isArray(list) ? list.map((item) => ({ ...item })) : []
  }

  return {
    items,
    addFromFragment,
    addFromFragments,
    removeByKey,
    removeByFragmentIds,
    reset,
    setItems,
  }
}
