import { NOTE_PREFIX, STRUCT_NOTE_PREFIX } from './constants'
import { dbAllDocs } from './dbClient'
import { listTagDocs } from './tagRepository'
import { datePartFromDateTime } from './utils'
import { extractMatchSnippets, plainTextForSnippet } from '../../utils/searchHighlight'

const DEFAULT_PAGE_SIZE = 30

function stripDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

function normalizeKeywords(keywords = []) {
  return [...new Set(
    (Array.isArray(keywords) ? keywords : [keywords])
      .map((item) => String(item ?? '').trim())
      .filter(Boolean),
  )]
}

function buildHaystack(parts = []) {
  return parts.filter(Boolean).join('\n').toLowerCase()
}

function matchesKeywords(haystack, keywords) {
  if (!keywords.length) return true
  return keywords.every((keyword) => haystack.includes(keyword.toLowerCase()))
}

function matchesDateRange(createTime, dateFrom, dateTo) {
  const date = datePartFromDateTime(createTime)
  if (!date) return !dateFrom && !dateTo
  if (dateFrom && date < dateFrom) return false
  if (dateTo && date > dateTo) return false
  return true
}

function matchesTag(doc, tagId) {
  if (!tagId) return true
  return String(doc?.tagId ?? '') === String(tagId)
}

function buildSnippets(rawText, keywords = []) {
  const primary = extractMatchSnippets(rawText, keywords)
  if (primary.length) return primary
  const fallback = extractMatchSnippets(plainTextForSnippet(rawText), keywords)
  return fallback.length ? fallback : []
}

function toFragmentResult(doc, tagNameById, keywords = []) {
  const tagName =
    (doc.tagId && tagNameById.get(String(doc.tagId))) || doc.title || ''
  const content = doc.markdownContent || doc.rawContent || doc.summary || ''
  let snippets = buildSnippets(content, keywords)
  if (!snippets.length && doc.title) {
    snippets = buildSnippets(doc.title, keywords)
  }
  return {
    id: doc.id,
    type: 'fragment',
    title: doc.title || tagName || '无标签',
    snippets,
    tagName,
    tagId: doc.tagId ?? null,
    createTime: doc.createTime || '',
  }
}

function toSedimentResult(doc, tagNameById, keywords = []) {
  const tagName = (doc.tagId && tagNameById.get(String(doc.tagId))) || ''
  const content = doc.content || ''
  let snippets = buildSnippets(content, keywords)
  if (!snippets.length && doc.title) {
    snippets = buildSnippets(doc.title, keywords)
  }
  return {
    id: doc.id,
    type: 'sediment',
    noteId: doc.id,
    title: doc.title || '无标题',
    snippets,
    tagName,
    tagId: doc.tagId ?? null,
    createTime: doc.createTime || '',
  }
}

function paginate(list, page, pageSize) {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const safeSize = Math.min(Math.max(Math.floor(pageSize) || DEFAULT_PAGE_SIZE, 1), 50)
  const total = list.length
  const start = (safePage - 1) * safeSize
  return {
    records: list.slice(start, start + safeSize),
    total,
    current: safePage,
    size: safeSize,
    pages: Math.max(1, Math.ceil(total / safeSize)),
  }
}

export async function globalSearch({
  keywords = [],
  tagId = null,
  dateFrom = null,
  dateTo = null,
  scopes = ['fragment', 'sediment'],
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) {
  const keywordList = normalizeKeywords(keywords)
  const scopeSet = new Set(
    (Array.isArray(scopes) ? scopes : [scopes]).filter(Boolean),
  )
  if (!scopeSet.size) {
    scopeSet.add('fragment')
    scopeSet.add('sediment')
  }

  const tags = await listTagDocs()
  const tagNameById = new Map(tags.map((tag) => [String(tag.id), tag.tagName]))

  const results = []

  if (scopeSet.has('fragment')) {
    const noteDocs = await dbAllDocs(NOTE_PREFIX)
    ;(noteDocs || [])
      .map(stripDoc)
      .filter((doc) => doc?.id && !doc.deletedAt && !doc.archivedAt)
      .forEach((doc) => {
        if (!matchesTag(doc, tagId)) return
        if (!matchesDateRange(doc.createTime, dateFrom, dateTo)) return
        const haystack = buildHaystack([
          doc.title,
          doc.summary,
          doc.rawContent,
          doc.markdownContent,
        ])
        if (!matchesKeywords(haystack, keywordList)) return
        results.push(toFragmentResult(doc, tagNameById, keywordList))
      })
  }

  if (scopeSet.has('sediment')) {
    const structDocs = await dbAllDocs(STRUCT_NOTE_PREFIX)
    ;(structDocs || [])
      .map(stripDoc)
      .filter((doc) => doc?.id && !doc.deletedAt)
      .forEach((doc) => {
        if (!matchesTag(doc, tagId)) return
        if (!matchesDateRange(doc.createTime, dateFrom, dateTo)) return
        const haystack = buildHaystack([doc.title, doc.content])
        if (!matchesKeywords(haystack, keywordList)) return
        results.push(toSedimentResult(doc, tagNameById, keywordList))
      })
  }

  results.sort((a, b) =>
    String(b.createTime || '').localeCompare(String(a.createTime || '')),
  )

  const pageData = paginate(results, page, pageSize)
  return {
    records: pageData.records,
    total: pageData.total,
    pageNo: pageData.current,
    pageSize: pageData.size,
    pages: pageData.pages,
    hasMore: pageData.current < pageData.pages,
  }
}
