import { resolveAttachmentRefsInMarkdown } from './attachmentMarkdown'

const FRAG_BLOCK_RE =
  /<!--\s*aw-frag-start\s+ids=([^\s>]+)\s+method=([^\s>]+)(?:\s+at=([^\s>]+))?\s*-->([\s\S]*?)<!--\s*aw-frag-end\s+ids=\1\s*-->/g

export function wrapFragmentIntroBlock(
  content,
  { fragmentIds = [], method = '', at = '' } = {},
) {
  const body = String(content ?? '').trim()
  const ids = (Array.isArray(fragmentIds) ? fragmentIds : [])
    .map((id) => String(id).trim())
    .filter(Boolean)
    .join(',')
  const methodKey = String(method ?? '').trim()
  const introducedAt = String(at || new Date().toISOString()).trim()
  if (!body || !ids || !methodKey) return body
  return `<!-- aw-frag-start ids=${ids} method=${methodKey} at=${introducedAt} -->\n${body}\n<!-- aw-frag-end ids=${ids} -->`
}

export function hasFragmentIntroMarkers(markdown) {
  FRAG_BLOCK_RE.lastIndex = 0
  return FRAG_BLOCK_RE.test(String(markdown ?? ''))
}

export function splitFragmentMarkedMarkdown(markdown) {
  const text = String(markdown ?? '')
  const segments = []
  let lastIndex = 0
  FRAG_BLOCK_RE.lastIndex = 0
  let match = FRAG_BLOCK_RE.exec(text)

  while (match) {
    if (match.index > lastIndex) {
      segments.push({ type: 'plain', content: text.slice(lastIndex, match.index) })
    }
    segments.push({
      type: 'fragment',
      fragmentIds: match[1],
      method: match[2],
      introducedAt: match[3] || '',
      content: match[4],
    })
    lastIndex = FRAG_BLOCK_RE.lastIndex
    match = FRAG_BLOCK_RE.exec(text)
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'plain', content: text.slice(lastIndex) })
  }

  return segments
}

export function buildEditorContentFromMarkdown(markdown, editor) {
  const resolved = resolveAttachmentRefsInMarkdown(markdown || '')
  if (!hasFragmentIntroMarkers(resolved)) {
    return { content: resolved, contentType: 'markdown' }
  }

  const segments = splitFragmentMarkedMarkdown(resolved)
  const docContent = []

  for (const segment of segments) {
    if (segment.type === 'plain') {
      const trimmed = segment.content.trim()
      if (!trimmed) continue
      const parsed = editor.markdown.parse(trimmed)
      if (parsed?.content?.length) {
        docContent.push(...parsed.content)
      }
      continue
    }

    const inner = segment.content.trim()
    let innerContent = [{ type: 'paragraph' }]
    if (inner) {
      const parsed = editor.markdown.parse(inner)
      if (parsed?.content?.length) {
        innerContent = parsed.content
      }
    }

    docContent.push({
      type: 'fragmentIntroBlock',
      attrs: {
        fragmentIds: segment.fragmentIds,
        method: segment.method,
        introducedAt: segment.introducedAt || '',
      },
      content: innerContent,
    })
  }

  return {
    content: {
      type: 'doc',
      content: docContent.length ? docContent : [{ type: 'paragraph' }],
    },
    contentType: 'json',
  }
}

export function setEditorMarkdownContent(
  editor,
  markdown,
  { emitUpdate = false, preserveSelection = false } = {},
) {
  if (!editor || editor.isDestroyed) return false
  try {
    const selection = preserveSelection ? editor.state.selection : null
    const payload = buildEditorContentFromMarkdown(markdown, editor)
    editor.commands.setContent(payload.content, {
      contentType: payload.contentType,
      emitUpdate,
    })
    if (selection) {
      const maxPos = editor.state.doc.content.size
      const from = Math.min(selection.from, maxPos)
      const to = Math.min(selection.to, maxPos)
      if (from >= 0 && to >= from) {
        editor.commands.setTextSelection({ from, to })
      }
    }
    return true
  } catch (error) {
    console.warn('[烂笔头] markdown 解析失败', error)
    return false
  }
}
