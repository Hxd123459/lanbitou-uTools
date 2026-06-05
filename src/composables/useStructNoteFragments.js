export function getFragmentTitle(note) {
  return note?.title || note?.fineTitle || '无标题'
}

export function getFragmentContent(note) {
  return note?.markdownContent || note?.text || note?.summary || ''
}

export function getFragmentPreview(note) {
  const text = getFragmentContent(note).replace(/\s+/g, ' ').trim()
  if (!text) return '（暂无内容）'
  return text.length > 72 ? `${text.slice(0, 72)}…` : text
}

export function buildFragmentBlock(note) {
  const title = getFragmentTitle(note)
  const body = getFragmentContent(note)
  return body ? `## ${title}\n\n${body}` : `## ${title}`
}

export function appendFragmentToContent(content, note) {
  const block = buildFragmentBlock(note)
  const trimmed = (content || '').trim()
  return trimmed ? `${trimmed}\n\n${block}` : block
}
