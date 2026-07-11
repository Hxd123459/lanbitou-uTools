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

const JSON_ARRAY_META_KEYS = new Set([
  'lb_images',
  'lb_files',
  'lb_source_fragments',
  'lb_introduced_fragments',
])

function parseMetaValue(key, value) {
  if (JSON_ARRAY_META_KEYS.has(key)) {
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
      if (JSON_ARRAY_META_KEYS.has(key) && Array.isArray(value)) {
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

const MIME_EXTENSION_MAP = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
}

const EXTENSION_MIME_MAP = Object.fromEntries(
  Object.entries(MIME_EXTENSION_MAP).map(([mime, ext]) => [ext, mime]),
)

export function mimeToExtension(mime = '', fileName = '') {
  const normalized = String(mime || '').toLowerCase()
  if (MIME_EXTENSION_MAP[normalized]) return MIME_EXTENSION_MAP[normalized]
  const fromName = String(fileName || '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  if (fromName && EXTENSION_MIME_MAP[fromName]) return fromName
  return 'bin'
}

export function extensionToMime(ext = '') {
  return EXTENSION_MIME_MAP[String(ext).toLowerCase()] || 'application/octet-stream'
}

export function normalizeBackupAttachmentMeta(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      id: item.id != null ? String(item.id) : '',
      file: item.file ? String(item.file) : '',
      mime: item.mime || item.mimeType || 'application/octet-stream',
      sort: item.sort ?? item.sortOrder ?? 0,
      name: item.name || item.fileName || '',
    }))
    .filter((item) => item.id && item.file)
}
