export function normalizeHighlightKeywords(source) {
  if (Array.isArray(source)) {
    return [...new Set(
      source.map((item) => String(item ?? '').trim()).filter(Boolean),
    )]
  }
  const text = String(source ?? '').trim()
  return text ? [text] : []
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function plainTextForSnippet(text) {
  let value = String(text ?? '')
  value = value.replace(/```[\s\S]*?```/g, ' ')
  value = value.replace(/`([^`]+)`/g, '$1')
  value = value.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  value = value.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  value = value.replace(/^#{1,6}\s+/gm, '')
  value = value.replace(/^>\s?/gm, '')
  value = value.replace(/^\s*[-+*]\s+/gm, '')
  value = value.replace(/^\s*\d+\.\s+/gm, '')
  value = value.replace(/\*\*([^*]+)\*\*/g, '$1')
  value = value.replace(/__([^_]+)__/g, '$1')
  return value.replace(/\s+/g, ' ').trim()
}

export function extractMatchSnippets(rawText, keywords = [], options = {}) {
  const keywordList = normalizeHighlightKeywords(keywords)
  const {
    contextBefore = 28,
    contextAfter = 56,
    maxSnippets = 6,
    previewLen = 160,
  } = options

  const text = plainTextForSnippet(rawText)
  if (!text) return []

  if (!keywordList.length) {
    if (text.length <= previewLen) return [text]
    return [`${text.slice(0, previewLen)}…`]
  }

  const lower = text.toLowerCase()
  const windows = []

  keywordList.forEach((keyword) => {
    const kw = keyword.toLowerCase()
    let idx = lower.indexOf(kw)
    while (idx !== -1) {
      windows.push({
        start: Math.max(0, idx - contextBefore),
        end: Math.min(text.length, idx + keyword.length + contextAfter),
      })
      idx = lower.indexOf(kw, idx + keyword.length)
    }
  })

  if (!windows.length) {
    if (text.length <= previewLen) return [text]
    return [`${text.slice(0, previewLen)}…`]
  }

  windows.sort((a, b) => a.start - b.start)
  const merged = []
  windows.forEach((win) => {
    const last = merged[merged.length - 1]
    if (!last || win.start > last.end + 16) {
      merged.push({ ...win })
    } else {
      last.end = Math.max(last.end, win.end)
    }
  })

  return merged.slice(0, maxSnippets).map(({ start, end }) => {
    let part = text.slice(start, end)
    if (start > 0) part = `…${part}`
    if (end < text.length) part = `${part}…`
    return part
  })
}

export function findMergedHighlightRanges(text, keywords = []) {
  const list = normalizeHighlightKeywords(keywords)
  const raw = String(text ?? '')
  if (!raw || !list.length) return []

  const lower = raw.toLowerCase()
  const matches = []
  list.forEach((keyword) => {
    const kw = keyword.toLowerCase()
    let idx = lower.indexOf(kw)
    while (idx !== -1) {
      matches.push({ start: idx, end: idx + keyword.length })
      idx = lower.indexOf(kw, idx + keyword.length)
    }
  })
  if (!matches.length) return []

  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged = []
  matches.forEach((match) => {
    const last = merged[merged.length - 1]
    if (!last || match.start >= last.end) {
      merged.push({ ...match })
    } else if (match.end > last.end) {
      last.end = match.end
    }
  })
  return merged
}

export function highlightPlainText(text, keywords = []) {
  const raw = String(text ?? '')
  const ranges = findMergedHighlightRanges(raw, keywords)
  if (!ranges.length) return escapeHtml(raw)

  let html = ''
  let cursor = 0
  ranges.forEach(({ start, end }) => {
    if (start > cursor) html += escapeHtml(raw.slice(cursor, start))
    html += `<mark class="note-highlight">${escapeHtml(raw.slice(start, end))}</mark>`
    cursor = end
  })
  if (cursor < raw.length) html += escapeHtml(raw.slice(cursor))
  return html
}
