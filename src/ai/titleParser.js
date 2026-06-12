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
  if (!message) return null

  const content = String(message.content ?? '').trim()
  const fromContent = parseTitleFromContent(content)
  if (fromContent) return fromContent

  const reasoning = String(
    message.reasoning_content ?? message.reasoning ?? '',
  ).trim()
  if (!reasoning) return null

  return extractTitleByRegex(reasoning) || tryParseJsonTitle(reasoning)
}
