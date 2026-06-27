import { LB_ATT_SCHEME } from './attachmentMarkdown'
import { getAttachmentBlobUrl } from '../storage/utools/attachment'
import { resolveResourceUrl } from '../api/http'
import {
  blobToDataUrl,
  blobToEmbeddableDataUrl,
  compressImageBlob,
  MAX_CLIPBOARD_MD_BYTES,
  utf8ByteLength,
} from './imageExport'

export function stripMarkdown(md) {
  if (!md) return ''
  return md
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```[^\n]*\n?|```/g, ''),
    )
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-+*]\s+\[[xX ]\]\s+/gm, '')
    .replace(/^\s*[-+*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function getNotePlainText(note) {
  const content = note?.markdownContent || note?.text || ''
  return stripMarkdown(content)
}

export function getNoteImages(note) {
  return Array.isArray(note?.images) ? note.images : []
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function legacyCopyText(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(ta)
  }
}

export async function writeTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
  } else {
    legacyCopyText(text)
  }
}

async function fetchImageBlob(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('fetch failed')
  return res.blob()
}

export async function copyNotePlainText(note) {
  const plain = getNotePlainText(note)
  if (!plain) throw new Error('empty')
  await writeTextToClipboard(plain)
  return { mode: 'plain' }
}

export async function copyNoteWithImages(note) {
  const plain = getNotePlainText(note)
  const images = getNoteImages(note)
  if (!plain && !images.length) throw new Error('empty')

  if (!images.length) {
    await writeTextToClipboard(plain)
    return { mode: 'rich', imageCount: 0 }
  }

  const imageDataUrls = []
  for (const img of images) {
    if (!img?.url) continue
    try {
      const blob = await fetchImageBlob(img.url)
      imageDataUrls.push(await blobToDataUrl(blob))
    } catch {
      // skip failed images
    }
  }

  if (!plain && !imageDataUrls.length) throw new Error('empty')

  const htmlParts = []
  if (plain) {
    htmlParts.push(`<div>${escapeHtml(plain).replace(/\n/g, '<br>')}</div>`)
  }
  imageDataUrls.forEach((dataUrl) => {
    htmlParts.push(`<img src="${dataUrl}" />`)
  })
  const html = htmlParts.join('')

  const plainFallback =
    plain ||
    imageDataUrls.map((_, index) => `[图片${index + 1}]`).join('\n')

  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([plainFallback], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ])
  } else if (plain) {
    await writeTextToClipboard(plain)
  } else {
    throw new Error('clipboard unsupported')
  }

  return { mode: 'rich', imageCount: imageDataUrls.length }
}

export async function copyNoteByMode(note, mode) {
  if (mode === 'plain') return copyNotePlainText(note)
  if (mode === 'rich') return copyNoteWithImages(note)
  throw new Error('unknown mode')
}

const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g

async function resolveMarkdownExportImage(src) {
  const trimmed = String(src ?? '').trim()
  if (!trimmed) {
    return { url: '', htmlSrc: '', embedded: false, skipped: false }
  }

  if (trimmed.startsWith('data:')) {
    return { url: trimmed, htmlSrc: trimmed, embedded: true, skipped: false }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed, htmlSrc: trimmed, embedded: true, skipped: false }
  }

  if (trimmed.startsWith('/')) {
    const publicUrl = resolveResourceUrl(trimmed)
    return { url: publicUrl, htmlSrc: publicUrl, embedded: true, skipped: false }
  }

  let blobUrl = trimmed
  if (trimmed.startsWith(LB_ATT_SCHEME)) {
    const attachmentId = decodeURIComponent(trimmed.slice(LB_ATT_SCHEME.length))
    blobUrl = getAttachmentBlobUrl(attachmentId)
    if (!blobUrl) {
      return { url: '', htmlSrc: '', embedded: false, skipped: true }
    }
  }

  if (!trimmed.startsWith('blob:') && !trimmed.startsWith(LB_ATT_SCHEME)) {
    return { url: trimmed, htmlSrc: trimmed, embedded: false, skipped: false }
  }

  try {
    const blob = await fetchImageBlob(blobUrl)
    const dataUrl = await blobToEmbeddableDataUrl(blob)
    if (dataUrl) {
      return { url: dataUrl, htmlSrc: dataUrl, embedded: true, skipped: false }
    }

    const compressed = await compressImageBlob(blob)
    const htmlDataUrl = await blobToDataUrl(compressed)
    return { url: '', htmlSrc: htmlDataUrl, embedded: false, skipped: true }
  } catch {
    return { url: '', htmlSrc: '', embedded: false, skipped: true }
  }
}

function buildExportMarkdown(text, replacements) {
  let result = text
  for (const [src, resolved] of replacements) {
    const nextUrl = resolved.url ?? ''
    result = result.split(`](${src})`).join(`](${nextUrl})`)
  }
  return result
}

function buildExportHtml(text, replacements) {
  const body = String(text ?? '').trim()
  if (!body) return ''

  const parts = []
  let lastIndex = 0
  for (const match of body.matchAll(MD_IMAGE_RE)) {
    const before = body.slice(lastIndex, match.index)
    if (before.trim()) {
      parts.push(`<div>${escapeHtml(before).replace(/\n/g, '<br>')}</div>`)
    }
    const alt = match[1] || '图片'
    const src = match[2]
    const htmlSrc = replacements.get(src)?.htmlSrc
    if (htmlSrc) {
      parts.push(`<p><img src="${htmlSrc}" alt="${escapeHtml(alt)}" /></p>`)
    }
    lastIndex = match.index + match[0].length
  }

  const tail = body.slice(lastIndex)
  if (tail.trim()) {
    parts.push(`<div>${escapeHtml(tail).replace(/\n/g, '<br>')}</div>`)
  }

  return parts.join('')
}

async function writeMarkdownExportToClipboard(markdown, html) {
  const mdBytes = utf8ByteLength(markdown)
  if (mdBytes > MAX_CLIPBOARD_MD_BYTES) {
    throw new Error('clipboard too large')
  }

  if (html && navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([markdown], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ])
    return
  }

  await writeTextToClipboard(markdown)
}

export async function copyMarkdownWithImages(markdown) {
  const text = String(markdown ?? '').trim()
  if (!text) throw new Error('empty')

  const matches = [...text.matchAll(MD_IMAGE_RE)]
  if (!matches.length) {
    await writeTextToClipboard(text)
    return { mode: 'markdown-export', imageCount: 0, skippedCount: 0 }
  }

  const srcReplacements = new Map()
  for (const match of matches) {
    const src = match[2]
    if (!srcReplacements.has(src)) {
      srcReplacements.set(src, await resolveMarkdownExportImage(src))
    }
  }

  let result = buildExportMarkdown(text, srcReplacements)
  let imageCount = 0
  let skippedCount = 0

  for (const resolved of srcReplacements.values()) {
    if (resolved.embedded && resolved.url) imageCount += 1
    if (resolved.skipped) skippedCount += 1
  }

  const html = buildExportHtml(text, srcReplacements)

  if (utf8ByteLength(result) > MAX_CLIPBOARD_MD_BYTES) {
    for (const [src, resolved] of srcReplacements) {
      if (resolved.url?.startsWith('data:')) {
        srcReplacements.set(src, { ...resolved, url: '', embedded: false, skipped: true })
      }
    }
    result = buildExportMarkdown(text, srcReplacements)
    imageCount = [...srcReplacements.values()].filter((r) => r.embedded && r.url).length
    skippedCount = [...srcReplacements.values()].filter((r) => r.skipped || !r.url).length
  }

  await writeMarkdownExportToClipboard(result, html)
  return { mode: 'markdown-export', imageCount, skippedCount }
}
