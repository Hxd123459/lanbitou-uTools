import { LB_ATT_SCHEME } from './attachmentMarkdown'
import { getAttachmentBlobUrl } from '../storage/utools/attachment'
import { resolveResourceUrl } from '../api/http'
import {
  blobToDataUrl,
  blobToEmbeddableDataUrl,
  blobToClipboardPng,
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

/** Windows / Office 兼容的 CF_HTML 格式 */
function wrapCfHtml(fragment) {
  const body =
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
    '<!--StartFragment-->' +
    fragment +
    '<!--EndFragment-->' +
    '</body></html>'

  const encoder = new TextEncoder()
  const byteLen = (str) => encoder.encode(str).length
  const pad = (n) => String(n).padStart(10, '0')

  const startHtmlPos = body.indexOf('<html>')
  const endHtmlPos = body.length
  const startFragPos = body.indexOf('<!--StartFragment-->') + '<!--StartFragment-->'.length
  const endFragPos = body.indexOf('<!--EndFragment-->')

  let header = ''
  for (let i = 0; i < 4; i += 1) {
    const startHtml = byteLen(header) + byteLen(body.slice(0, startHtmlPos))
    const endHtml = byteLen(header) + byteLen(body.slice(0, endHtmlPos))
    const startFragment = byteLen(header) + byteLen(body.slice(0, startFragPos))
    const endFragment = byteLen(header) + byteLen(body.slice(0, endFragPos))
    header =
      `Version:0.9\r\nStartHTML:${pad(startHtml)}\r\nEndHTML:${pad(endHtml)}` +
      `\r\nStartFragment:${pad(startFragment)}\r\nEndFragment:${pad(endFragment)}\r\n`
  }

  return header + body
}

async function writeMultiFormatClipboard({ plain, htmlFragment, imageBlob }) {
  if (!navigator.clipboard?.write || !window.ClipboardItem) {
    if (plain) {
      await writeTextToClipboard(plain)
      return
    }
    throw new Error('clipboard unsupported')
  }

  const payload = {}
  if (plain) {
    payload['text/plain'] = new Blob([plain], { type: 'text/plain' })
  }
  if (htmlFragment) {
    payload['text/html'] = new Blob([wrapCfHtml(htmlFragment)], { type: 'text/html' })
  }
  if (imageBlob) {
    const pngBlob = await blobToClipboardPng(imageBlob)
    payload['image/png'] = pngBlob
  }

  if (!Object.keys(payload).length) throw new Error('empty clipboard payload')

  await navigator.clipboard.write([new ClipboardItem(payload)])
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
    htmlParts.push(`<p><img src="${dataUrl}" alt="图片" /></p>`)
  })
  const htmlFragment = htmlParts.join('')

  const plainFallback =
    plain ||
    imageDataUrls.map((_, index) => `[图片${index + 1}]`).join('\n')

  let imageBlob = null
  if (!plain && imageDataUrls.length === 1) {
    try {
      const blob = await fetchImageBlob(images.find((img) => img?.url)?.url)
      imageBlob = blob
    } catch {
      // html/plain fallback below
    }
  }

  await writeMultiFormatClipboard({
    plain: plainFallback,
    htmlFragment,
    imageBlob,
  })

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
    return { url: '', htmlSrc: '', embedded: false, skipped: false, blob: null, mime: '' }
  }

  if (trimmed.startsWith('data:')) {
    try {
      const blob = await fetchImageBlob(trimmed)
      const clipboardBlob = await compressImageBlob(blob)
      return {
        url: trimmed,
        htmlSrc: trimmed,
        embedded: true,
        skipped: false,
        blob: clipboardBlob,
        mime: clipboardBlob.type || blob.type || 'image/png',
      }
    } catch {
      return { url: trimmed, htmlSrc: trimmed, embedded: true, skipped: false, blob: null, mime: '' }
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const blob = await fetchImageBlob(trimmed)
      const clipboardBlob = await compressImageBlob(blob)
      return {
        url: trimmed,
        htmlSrc: trimmed,
        embedded: true,
        skipped: false,
        blob: clipboardBlob,
        mime: clipboardBlob.type || blob.type || 'image/png',
      }
    } catch {
      return { url: trimmed, htmlSrc: trimmed, embedded: true, skipped: false, blob: null, mime: '' }
    }
  }

  if (trimmed.startsWith('/')) {
    const publicUrl = resolveResourceUrl(trimmed)
    return { url: publicUrl, htmlSrc: publicUrl, embedded: true, skipped: false, blob: null, mime: '' }
  }

  let blobUrl = trimmed
  if (trimmed.startsWith(LB_ATT_SCHEME)) {
    const attachmentId = decodeURIComponent(trimmed.slice(LB_ATT_SCHEME.length))
    blobUrl = getAttachmentBlobUrl(attachmentId)
    if (!blobUrl) {
      return { url: '', htmlSrc: '', embedded: false, skipped: true, blob: null, mime: '' }
    }
  }

  if (!trimmed.startsWith('blob:') && !trimmed.startsWith(LB_ATT_SCHEME)) {
    return { url: trimmed, htmlSrc: trimmed, embedded: false, skipped: false, blob: null, mime: '' }
  }

  try {
    const blob = await fetchImageBlob(blobUrl)
    const dataUrl = await blobToEmbeddableDataUrl(blob)
    const clipboardBlob = await compressImageBlob(blob)
    const mime = clipboardBlob.type || blob.type || 'image/png'

    if (dataUrl) {
      return {
        url: dataUrl,
        htmlSrc: dataUrl,
        embedded: true,
        skipped: false,
        blob: clipboardBlob,
        mime,
      }
    }

    const htmlDataUrl = await blobToDataUrl(clipboardBlob)
    return {
      url: '',
      htmlSrc: htmlDataUrl,
      embedded: false,
      skipped: true,
      blob: clipboardBlob,
      mime,
    }
  } catch {
    return { url: '', htmlSrc: '', embedded: false, skipped: true, blob: null, mime: '' }
  }
}

function buildExportMarkdown(text, replacements) {
  return String(text ?? '').replace(MD_IMAGE_RE, (match, alt, src) => {
    const resolved = replacements.get(src)
    if (!resolved) return match

    const url =
      resolved.url ||
      (resolved.htmlSrc?.startsWith('https://') ? resolved.htmlSrc : '')

    if (url) return `![${alt}](${url})`
    if (resolved.htmlSrc) return `![${alt}](${resolved.htmlSrc})`
    return alt ? `[${alt}]` : '[图片]'
  })
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

function isImageOnlyMarkdown(text, matches) {
  if (matches.length !== 1) return false
  const withoutImage = text.replace(MD_IMAGE_RE, '').trim()
  return !withoutImage
}

function pickSingleImageBlob(matches, replacements) {
  if (matches.length !== 1) return null
  const src = matches[0][2]
  const resolved = replacements.get(src)
  if (!resolved?.blob) return null
  return { blob: resolved.blob, mime: resolved.mime || 'image/png' }
}

async function writeMarkdownExportToClipboard({ markdown, htmlFragment, imageBlob }) {
  const mdBytes = utf8ByteLength(markdown)
  if (mdBytes > MAX_CLIPBOARD_MD_BYTES) {
    throw new Error('clipboard too large')
  }

  await writeMultiFormatClipboard({
    plain: markdown,
    htmlFragment,
    imageBlob,
  })
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
    if ((resolved.embedded && resolved.url) || resolved.htmlSrc) imageCount += 1
    if (resolved.skipped) skippedCount += 1
  }

  const htmlFragment = buildExportHtml(text, srcReplacements)
  const imageOnly = isImageOnlyMarkdown(text, matches)
  const singleImage = imageOnly ? pickSingleImageBlob(matches, srcReplacements) : null

  if (utf8ByteLength(result) > MAX_CLIPBOARD_MD_BYTES) {
    for (const [src, resolved] of srcReplacements) {
      if (resolved.url?.startsWith('data:')) {
        srcReplacements.set(src, { ...resolved, url: '', embedded: false, skipped: true })
      }
    }
    result = buildExportMarkdown(text, srcReplacements)
    imageCount = [...srcReplacements.values()].filter((r) => r.htmlSrc).length
    skippedCount = [...srcReplacements.values()].filter((r) => r.skipped || !r.url).length
  }

  await writeMarkdownExportToClipboard({
    markdown: result,
    htmlFragment,
    imageBlob: singleImage?.blob ?? null,
  })

  return {
    mode: 'markdown-export',
    imageCount,
    skippedCount,
    imageOnly,
    hasBinaryImage: Boolean(singleImage?.blob),
  }
}
