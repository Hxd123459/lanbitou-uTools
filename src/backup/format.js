export const LB_VERSION = 1
export const BACKUP_FORMAT = 'lanbitou-backup'
export const FRONTMATTER_BOUNDARY = '---'

export const FRAGMENTS_DIR = '碎片'
export const SEDIMENT_DIR = '沉淀'
export const ATTACHMENTS_DIR = '_attachments'

export const LB_TYPE_FRAGMENT = 'fragment'
export const LB_TYPE_SEDIMENT = 'sediment'

export function parseFrontmatter(text) {
  const raw = String(text ?? '')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { meta: {}, body: raw }
  }

  const meta = {}
  const lines = match[1].split(/\r?\n/)

  for (const line of lines) {
    if (!line.trim()) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    meta[key] = parseMetaValue(key, value)
  }

  return { meta, body: match[2] }
}

function parseMetaValue(key, value) {
  if (key === 'lb_images' || key === 'lb_source_fragments') {
    const parsed = tryParseJsonArray(value)
    if (parsed) return parsed
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    if (value.includes('{')) {
      const parsed = tryParseJsonArray(value)
      if (parsed) return parsed
    }
    return parseInlineList(value)
  }

  return parseScalar(value)
}

function tryParseJsonArray(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function parseInlineList(value) {
  const inner = value.slice(1, -1).trim()
  if (!inner) return []
  return inner
    .split(',')
    .map((part) => parseScalar(part.trim()))
    .filter((part) => part !== '' && part != null)
}

function parseScalar(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function formatScalar(value) {
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value == null) return 'null'
  if (typeof value === 'number') return String(value)
  const text = String(value)
  if (/[:#\[\]{}&*!|>'"%@`,]/.test(text) || text.includes('\n')) {
    return JSON.stringify(text)
  }
  return text
}

function formatList(values) {
  if (!Array.isArray(values) || !values.length) return '[]'
  return `[${values.map((item) => formatScalar(item)).join(', ')}]`
}

export function serializeFrontmatter(meta, body = '') {
  const lines = Object.entries(meta || {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if ((key === 'lb_images' || key === 'lb_source_fragments') && Array.isArray(value)) {
        return `${key}: ${JSON.stringify(value)}`
      }
      if (Array.isArray(value)) {
        return `${key}: ${formatList(value)}`
      }
      return `${key}: ${formatScalar(value)}`
    })

  const content = String(body ?? '').trimStart()
  return `${FRONTMATTER_BOUNDARY}\n${lines.join('\n')}\n${FRONTMATTER_BOUNDARY}\n\n${content}`
}

export function sanitizeZipPath(segment) {
  const text = String(segment ?? '')
    .replace(/\\/g, '/')
    .replace(/\0/g, '')
    .trim()
  if (!text || text === '.' || text === '..') return ''
  if (text.includes('..')) return ''
  return text.replace(/^\/+|\/+$/g, '')
}

export function joinZipPath(...parts) {
  return parts
    .map(sanitizeZipPath)
    .filter(Boolean)
    .join('/')
}

export function isLanbitouBackup(entryNames = []) {
  return new Set(entryNames).has('manifest.json')
}

export function isPlatformMarkdown(meta = {}) {
  return meta.lb_type === LB_TYPE_FRAGMENT || meta.lb_type === LB_TYPE_SEDIMENT
}

export function mimeToExtension(mime = '') {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return map[String(mime).toLowerCase()] || 'bin'
}
