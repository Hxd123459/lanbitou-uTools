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

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
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
