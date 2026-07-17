/**
 * 渲染进程兜底注册 onMainPush（preload 未生效或进程未重启时）
 * 与 public/preload/mainPush.js 逻辑保持一致，必须同步返回数组
 */
const NOTE_PREFIX = 'lanbitou/note/'
const STRUCT_NOTE_PREFIX = 'lanbitou/struct/note/'
export const SEARCH_NOTES_CODE = 'search_notes'
const MAX_RESULTS = 8
const SNIPPET_LEN = 72

function normalizeKeywords(text) {
  return [
    ...new Set(
      String(text ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    ),
  ]
}

function buildHaystack(parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).slice(0, 2000))
    .join('\n')
    .toLowerCase()
}

function matchesKeywords(haystack, keywords) {
  if (!keywords.length) return false
  return keywords.every((keyword) => haystack.includes(keyword.toLowerCase()))
}

function extractSnippet(rawText, keywords) {
  const text = String(rawText ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  const lower = text.toLowerCase()
  let index = -1
  for (const keyword of keywords) {
    const pos = lower.indexOf(keyword.toLowerCase())
    if (pos >= 0 && (index < 0 || pos < index)) index = pos
  }
  if (index < 0) return text.slice(0, SNIPPET_LEN)
  const start = Math.max(0, index - 12)
  return `${start > 0 ? '...' : ''}${text.slice(start, start + SNIPPET_LEN)}`
}

function ensureDocs(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value?.then === 'function') return []
  return []
}

function searchNotesSync(payload) {
  const keywords = normalizeKeywords(payload)
  const db = window.utools?.db
  if (!keywords.length || typeof db?.allDocs !== 'function') return []

  const results = []

  try {
    const noteDocs = ensureDocs(db.allDocs(NOTE_PREFIX))
    for (const doc of noteDocs) {
      if (results.length >= MAX_RESULTS) break
      if (!doc?.id || doc.deletedAt || doc.archivedAt) continue
      const haystack = buildHaystack([
        doc.title,
        doc.summary,
        doc.rawContent,
        doc.markdownContent,
      ])
      if (!matchesKeywords(haystack, keywords)) continue
      const content = doc.markdownContent || doc.rawContent || doc.summary || ''
      results.push({
        noteId: doc.id,
        noteType: 'fragment',
        title: doc.title || '无标签',
        text: extractSnippet(content, keywords) || doc.title || '碎片笔记',
        createTime: doc.createTime || '',
      })
    }
  } catch (error) {
    console.error('[烂笔头] renderer mainPush 搜索碎片失败', error)
  }

  try {
    if (results.length < MAX_RESULTS) {
      const structDocs = ensureDocs(db.allDocs(STRUCT_NOTE_PREFIX))
      for (const doc of structDocs) {
        if (results.length >= MAX_RESULTS) break
        if (!doc?.id || doc.deletedAt) continue
        const haystack = buildHaystack([doc.title, doc.content])
        if (!matchesKeywords(haystack, keywords)) continue
        results.push({
          noteId: doc.id,
          noteType: 'sediment',
          title: doc.title || '无标题',
          text: extractSnippet(doc.content || '', keywords) || doc.title || '沉淀长文',
          createTime: doc.createTime || '',
        })
      }
    }
  } catch (error) {
    console.error('[烂笔头] renderer mainPush 搜索沉淀失败', error)
  }

  results.sort((a, b) =>
    String(b.createTime || '').localeCompare(String(a.createTime || '')),
  )

  return results.slice(0, MAX_RESULTS).map((item) => {
    const isSediment = item.noteType === 'sediment'
    return {
      icon: isSediment ? 'icons/sediment.svg' : 'icons/fragment.svg',
      title: isSediment ? `[沉淀] ${item.title}` : item.title,
      text: item.text,
      noteId: item.noteId,
      noteType: item.noteType,
      noteTitle: item.title,
    }
  })
}

export function setupMainPushSearch() {
  if (typeof window === 'undefined' || typeof window.utools?.onMainPush !== 'function') {
    return
  }
  if (window.__lanbitouMainPushBound) return
  window.__lanbitouMainPushBound = true

  window.utools.onMainPush(
    (action) => {
      try {
        if (action?.code !== SEARCH_NOTES_CODE) return []
        if (typeof action.payload !== 'string') return []
        return searchNotesSync(action.payload)
      } catch (error) {
        console.error('[烂笔头] renderer onMainPush 异常', error)
        return []
      }
    },
    (action) => {
      try {
        if (action?.code !== SEARCH_NOTES_CODE) return
        const option = action.option
        if (!option?.noteId) return
        const keyword =
          typeof action.payload === 'string' ? String(action.payload).trim() : ''
        window.__lanbitouPendingSearch = {
          keyword,
          id: option.noteId,
          noteId: option.noteId,
          type: option.noteType || 'fragment',
          noteType: option.noteType || 'fragment',
          title: option.noteTitle || option.title || '',
        }
        window.__lanbitouOpenNote = window.__lanbitouPendingSearch
        return true
      } catch (error) {
        console.error('[烂笔头] renderer onMainPush 选择异常', error)
        return true
      }
    },
  )
}
