import { getNotePlainText } from './copyNoteContent'
import { blobToClipboardPng } from './imageExport'

const CARD_WIDTH = 480
const PADDING = 28
const SCALE = 2
const SUMMARY_MAX_CHARS = 240
const BRAND = '烂笔头'

const FONT =
  '"Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'

const COLORS = {
  bg: '#ffffff',
  border: '#e4e4e7',
  text: '#09090b',
  secondary: '#71717a',
  accent: '#2563eb',
  tagBg: 'rgba(24, 24, 27, 0.08)',
  tagText: '#3f3f46',
  divider: '#f4f4f5',
}

export function buildShareCardData(note) {
  const title = String(note?.title ?? '').trim()
  const tag = title ? `#${title}` : ''
  const plain = getNotePlainText(note)
  const summary = truncateSummary(plain)
  const time = formatShareTime(note?.createdAt)
  return { title, tag, summary, time, brand: BRAND }
}

function truncateSummary(text) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return '（暂无内容）'
  if (normalized.length <= SUMMARY_MAX_CHARS) return normalized
  return `${normalized.slice(0, SUMMARY_MAX_CHARS).trim()}…`
}

function formatShareTime(dateValue) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function wrapText(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const char of text) {
    const next = line + char
    if (char === '\n') {
      if (line) lines.push(line)
      line = ''
      continue
    }
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function measureCardHeight(ctx, data, contentWidth) {
  let height = PADDING
  if (data.title) {
    height += 30
    height += 12
  }
  if (data.tag) {
    height += 26
    height += 16
  }
  height += 1 + 16
  ctx.font = `400 15px ${FONT}`
  const summaryLines = wrapText(ctx, data.summary, contentWidth)
  height += summaryLines.length * 24
  height += 16 + 1 + PADDING
  if (data.time) height += 18
  return Math.max(180, height)
}

function drawShareCard(ctx, data, width, height) {
  const contentWidth = width - PADDING * 2
  let y = PADDING

  ctx.fillStyle = COLORS.bg
  roundRect(ctx, 0, 0, width, height, 14)
  ctx.fill()

  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 14)
  ctx.stroke()

  if (data.title) {
    ctx.fillStyle = COLORS.text
    ctx.font = `700 20px ${FONT}`
    ctx.fillText(data.title, PADDING, y + 20)
    y += 30 + 12
  }

  if (data.tag) {
    ctx.font = `600 13px ${FONT}`
    const tagWidth = ctx.measureText(data.tag).width + 20
    const tagHeight = 26
    ctx.fillStyle = COLORS.tagBg
    roundRect(ctx, PADDING, y, tagWidth, tagHeight, 999)
    ctx.fill()
    ctx.fillStyle = COLORS.tagText
    ctx.fillText(data.tag, PADDING + 10, y + 18)
    y += tagHeight + 16
  }

  ctx.strokeStyle = COLORS.divider
  ctx.beginPath()
  ctx.moveTo(PADDING, y)
  ctx.lineTo(width - PADDING, y)
  ctx.stroke()
  y += 17

  ctx.fillStyle = COLORS.text
  ctx.font = `400 15px ${FONT}`
  const summaryLines = wrapText(ctx, data.summary, contentWidth)
  summaryLines.forEach((line) => {
    ctx.fillText(line, PADDING, y + 14)
    y += 24
  })

  y += 16
  ctx.strokeStyle = COLORS.divider
  ctx.beginPath()
  ctx.moveTo(PADDING, y)
  ctx.lineTo(width - PADDING, y)
  ctx.stroke()
  y += 17

  ctx.fillStyle = COLORS.secondary
  ctx.font = `400 12px ${FONT}`
  const footer = data.time ? `${data.brand} · ${data.time}` : data.brand
  ctx.fillText(footer, PADDING, y + 10)
}

export async function renderShareCardBlob(note) {
  const data = buildShareCardData(note)
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('canvas unsupported')

  measureCtx.font = `400 15px ${FONT}`
  const contentWidth = CARD_WIDTH - PADDING * 2
  const cardHeight = measureCardHeight(measureCtx, data, contentWidth)

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH * SCALE
  canvas.height = cardHeight * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unsupported')

  ctx.scale(SCALE, SCALE)
  drawShareCard(ctx, data, CARD_WIDTH, cardHeight)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('render failed'))
    }, 'image/png')
  })

  return blob
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function copyShareCard(note) {
  const blob = await renderShareCardBlob(note)
  const png = await blobToClipboardPng(blob)
  if (!navigator.clipboard?.write || !window.ClipboardItem) {
    throw new Error('clipboard unsupported')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  return { mode: 'share-copy' }
}

export async function saveShareCard(note) {
  const blob = await renderShareCardBlob(note)
  const stamp = Date.now()
  downloadBlob(blob, `lanbitou-share-${stamp}.png`)
  return { mode: 'share-save' }
}

export async function shareNoteCardByMode(note, mode) {
  if (mode === 'share-copy') return copyShareCard(note)
  if (mode === 'share-save') return saveShareCard(note)
  throw new Error('unknown mode')
}
