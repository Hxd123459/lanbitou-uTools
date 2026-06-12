export const TITLE_MAX_LEN = 5

export function sanitizeNoteTitle(value) {
  const title = String(value ?? '').trim()
  if (!title) return null
  if (/[{}\[\]"\\/:]/.test(title)) return null
  const normalized = title.replace(/\s+/g, '')
  if (!normalized || normalized.length > TITLE_MAX_LEN) {
    if (!normalized) return null
    return normalized.slice(0, TITLE_MAX_LEN)
  }
  return normalized
}

function normalizeJsonText(text) {
  let normalized = String(text ?? '').trim()
  const fence = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) normalized = fence[1].trim()
  return normalized.replace(/[\n\r\t]/g, '').trim()
}

function tryParseJsonTitle(text) {
  const normalized = normalizeJsonText(text)
  if (!normalized) return null
  try {
    const json = JSON.parse(normalized)
    return sanitizeNoteTitle(json.title)
  } catch {
    return null
  }
}

/** @returns {{ title: string|null, resolved: boolean }} */
export function parseTitleResultFromText(text) {
  const normalized = normalizeJsonText(text)
  if (!normalized) return { title: null, resolved: false }

  try {
    const json = JSON.parse(normalized)
    if (!Object.prototype.hasOwnProperty.call(json, 'title')) {
      return { title: null, resolved: false }
    }
    const raw = json.title
    if (raw == null || String(raw).trim() === '') {
      return { title: null, resolved: true }
    }
    return { title: sanitizeNoteTitle(raw), resolved: true }
  } catch {
    // fall through
  }

  const fromRegex = extractTitleByRegex(normalized)
  if (fromRegex) return { title: fromRegex, resolved: true }

  return { title: null, resolved: false }
}

/** @returns {{ title: string|null, resolved: boolean }} */
export function parseTitleResultFromAssistantMessage(message) {
  if (!message) return { title: null, resolved: false }

  const content = String(message.content ?? '').trim()
  const fromContent = parseTitleResultFromText(content)
  if (fromContent.resolved) return fromContent

  const reasoning = String(
    message.reasoning_content ?? message.reasoning ?? '',
  ).trim()
  if (!reasoning) return { title: null, resolved: false }

  const fromReasoning = parseTitleResultFromText(reasoning)
  if (fromReasoning.resolved) return fromReasoning

  const title = extractTitleByRegex(reasoning) || tryParseJsonTitle(reasoning)
  if (title) return { title, resolved: true }

  return { title: null, resolved: false }
}

function extractTitleByRegex(text) {
  const normalized = normalizeJsonText(text)
  if (!normalized) return null

  const patterns = [
    /\{"title"\s*:\s*"([^"\\]{1,20})"\}/,
    /"title"\s*:\s*"([^"\\]{1,20})"/,
    /'title'\s*:\s*'([^'\\]{1,20})'/,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match) {
      const title = sanitizeNoteTitle(match[1])
      if (title) return title
    }
  }

  return null
}

export function parseTitleFromContent(content) {
  if (!content) return null
  return tryParseJsonTitle(content) || extractTitleByRegex(content)
}

export function parseTitleFromAssistantMessage(message) {
  return parseTitleResultFromAssistantMessage(message).title
}
