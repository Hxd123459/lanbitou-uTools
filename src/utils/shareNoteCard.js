import { getNotePlainText } from './copyNoteContent'
import { blobToClipboardPng } from './imageExport'

const CARD_WIDTH = 480
const CARD_PADDING = 32
const OUTER_PADDING = 20
const SCALE = 2
/** 超长内容最多渲染行数，超出加省略号，避免画布过大 */
const SUMMARY_MAX_LINES = 60
const TITLE_LINE_HEIGHT = 26
const SUMMARY_LINE_HEIGHT = 26
const BRAND = '烂笔头'

const FONT =
  '"Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'

const COLORS = {
  canvasBg: '#f4f4f5',
  cardBg: '#ffffff',
  text: '#09090b',
  summary: '#3f3f46',
  secondary: '#a1a1aa',
  shadow: 'rgba(24, 24, 27, 0.08)',
}

export function buildShareCardData(note) {
  const title = String(note?.title ?? '').trim()
  const plain = getNotePlainText(note)
  const summary = normalizeSummary(plain)
  const time = formatShareTime(note?.createdAt)
  return { title, summary, time }
}

function formatFooter(time) {
  const source = `截图来自「${BRAND}」`
  return time ? `${source} · ${time}` : source
}

function normalizeSummary(text) {
  const normalized = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!normalized) return '（暂无内容）'
  return normalized
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
    if (char === '\n') {
      lines.push(line)
      line = ''
      continue
    }
    const next = line + char
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  }
  if (line || !lines.length) lines.push(line)
  return lines
}

function limitLines(lines, maxLines) {
  if (lines.length <= maxLines) return lines
  const clipped = lines.slice(0, maxLines)
  const last = clipped[clipped.length - 1] || ''
  clipped[clipped.length - 1] = `${last.replace(/…$/, '').trimEnd()}…`
  return clipped
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

function getTitleLines(ctx, title, contentWidth) {
  if (!title) return []
  const label = title.startsWith('#') ? title : `#${title}`
  ctx.font = `700 18px ${FONT}`
  return wrapText(ctx, label, contentWidth)
}

function getSummaryLines(ctx, summary, contentWidth) {
  ctx.font = `400 16px ${FONT}`
  return limitLines(wrapText(ctx, summary, contentWidth), SUMMARY_MAX_LINES)
}

function measureCardHeight(ctx, data, contentWidth) {
  let height = CARD_PADDING

  const titleLines = getTitleLines(ctx, data.title, contentWidth)
  if (titleLines.length) {
    height += titleLines.length * TITLE_LINE_HEIGHT
    height += 18
  } else {
    height += 4
  }

  const summaryLines = getSummaryLines(ctx, data.summary, contentWidth)
  height += summaryLines.length * SUMMARY_LINE_HEIGHT
  height += 24 + CARD_PADDING + 20
  return Math.max(160, height)
}

function drawCardShadow(ctx, x, y, w, h) {
  ctx.save()
  ctx.shadowColor = COLORS.shadow
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  ctx.fillStyle = COLORS.cardBg
  roundRect(ctx, x, y, w, h, 16)
  ctx.fill()
  ctx.restore()
}

function drawShareCard(ctx, data, cardWidth, cardHeight) {
  const contentWidth = cardWidth - CARD_PADDING * 2
  const cardX = OUTER_PADDING
  const cardY = OUTER_PADDING
  const textX = cardX + CARD_PADDING

  ctx.fillStyle = COLORS.canvasBg
  ctx.fillRect(0, 0, cardWidth + OUTER_PADDING * 2, cardHeight + OUTER_PADDING * 2)

  drawCardShadow(ctx, cardX, cardY, cardWidth, cardHeight)

  ctx.fillStyle = COLORS.cardBg
  roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 16)
  ctx.fill()

  let y = cardY + CARD_PADDING

  const titleLines = getTitleLines(ctx, data.title, contentWidth)
  if (titleLines.length) {
    ctx.fillStyle = COLORS.text
    ctx.font = `700 18px ${FONT}`
    titleLines.forEach((line) => {
      ctx.fillText(line, textX, y + 18)
      y += TITLE_LINE_HEIGHT
    })
    y += 18
  }

  ctx.fillStyle = COLORS.summary
  ctx.font = `400 16px ${FONT}`
  const summaryLines = getSummaryLines(ctx, data.summary, contentWidth)
  summaryLines.forEach((line) => {
    ctx.fillText(line, textX, y + 16)
    y += SUMMARY_LINE_HEIGHT
  })

  const footerY = cardY + cardHeight - CARD_PADDING
  ctx.fillStyle = COLORS.secondary
  ctx.font = `400 11px ${FONT}`
  ctx.fillText(formatFooter(data.time), textX, footerY)
}

export async function renderShareCardBlob(note) {
  const data = buildShareCardData(note)
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('canvas unsupported')

  const contentWidth = CARD_WIDTH - CARD_PADDING * 2
  const cardHeight = measureCardHeight(measureCtx, data, contentWidth)
  const totalWidth = CARD_WIDTH + OUTER_PADDING * 2
  const totalHeight = cardHeight + OUTER_PADDING * 2

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth * SCALE
  canvas.height = totalHeight * SCALE
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
