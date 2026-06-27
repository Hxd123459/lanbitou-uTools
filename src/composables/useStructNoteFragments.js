export function getFragmentTitle(note) {
  return note?.title || note?.fineTitle || '无标题'
}

import { buildFragmentImageMarkdown } from '../utils/attachmentMarkdown'

export function getFragmentContent(note) {
  return note?.markdownContent || note?.text || note?.summary || ''
}

export function getFragmentImages(note) {
  return Array.isArray(note?.images) ? note.images : []
}

export function getFragmentPreview(note) {
  const text = getFragmentContent(note).replace(/\s+/g, ' ').trim()
  if (!text) return '（暂无内容）'
  return text.length > 72 ? `${text.slice(0, 72)}…` : text
}

export function getFragmentChipLabel(note) {
  const text = getFragmentContent(note).replace(/\s+/g, ' ').trim()
  if (!text) return '（暂无内容）'
  return text.length > 48 ? `${text.slice(0, 48)}…` : text
}

export function buildFragmentBlock(note) {
  const text = getFragmentContent(note).trim()
  const imagesMd = buildFragmentImageMarkdown(note)
  if (!text && !imagesMd) return ''
  if (!text) return imagesMd
  if (!imagesMd) return text
  return `${text}\n\n${imagesMd}`
}

export function appendFragmentToContent(content, note) {
  const block = buildFragmentBlock(note)
  if (!block) return content || ''
  const trimmed = (content || '').trim()
  return trimmed ? `${trimmed}\n\n${block}` : block
}

function normalizeForContentMatch(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

export function detectInsertedFragmentIds(content, fragments) {
  const inserted = new Set()
  const body = normalizeForContentMatch(content)
  if (!body) return inserted

  for (const note of Array.isArray(fragments) ? fragments : []) {
    const id = note?.id
    if (!id) continue

    const block = buildFragmentBlock(note)
    const normalizedBlock = normalizeForContentMatch(block)
    if (normalizedBlock.length >= 8 && body.includes(normalizedBlock)) {
      inserted.add(String(id))
      continue
    }

    const text = getFragmentContent(note).trim()
    if (text.length >= 12) {
      const probe = normalizeForContentMatch(text.slice(0, Math.min(80, text.length)))
      if (probe.length >= 12 && body.includes(probe)) {
        inserted.add(String(id))
      }
    }
  }

  return inserted
}

/** 打开长文时解析已引入碎片：有持久化字段则以其为准；否则正文匹配；再否则历史数据兜底 */
export function resolveIntroducedFragmentIds({
  sourceFragmentIds = [],
  introducedFragmentIds,
  content = '',
  fragmentNotes = [],
}) {
  if (introducedFragmentIds !== undefined && introducedFragmentIds !== null) {
    return new Set(
      (Array.isArray(introducedFragmentIds) ? introducedFragmentIds : [])
        .map((id) => String(id))
        .filter(Boolean),
    )
  }

  const detected = detectInsertedFragmentIds(content, fragmentNotes)
  if (detected.size) return detected

  const source = (Array.isArray(sourceFragmentIds) ? sourceFragmentIds : [])
    .map((id) => String(id))
    .filter(Boolean)
  if (normalizeForContentMatch(content) && source.length) {
    return new Set(source)
  }

  return new Set()
}

export function formatFragmentTime(dateValue) {
  if (!dateValue) return '----'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '----'
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}
