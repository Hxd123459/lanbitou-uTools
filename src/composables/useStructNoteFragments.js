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
