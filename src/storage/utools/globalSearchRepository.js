import { isImageMimeType } from '../../constants/uploadLimits.js'
import { LB_ATT_SCHEME } from '../../utils/attachmentMarkdown.js'
import { extractMatchSnippets, plainTextForSnippet } from '../../utils/searchHighlight.js'
import { imagesToBlocks, getAttachmentBlobUrl } from './attachment.js'
import { NOTE_PREFIX, PROJECT_PREFIX, STRUCT_NOTE_PREFIX, TODO_PREFIX } from './constants.js'
import { dbAllDocs, dbGetAttachmentType } from './dbClient.js'
import { listTagDocs } from './tagRepository.js'
import { datePartFromDateTime } from './utils.js'

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

function blocksToAttachments(blocks = []) {
  return (Array.isArray(blocks) ? blocks : [])
    .filter((block) => block && block.fileUrl)
    .map((block) => ({
      id: block.id,
      url: block.fileUrl,
      sortOrder: block.sortOrder ?? 0,
      kind: block.type === 'file' ? 'file' : 'image',
      name: block.fileName || '',
      mimeType: block.mimeType || '',
    }))
}

function attachmentNamesFromImages(images = []) {
  return (Array.isArray(images) ? images : [])
    .map((img) => img?.fileName || img?.name || '')
    .filter(Boolean)
}

function decodeLbAttRef(ref) {
  if (!ref?.startsWith(LB_ATT_SCHEME)) return ''
  try {
    return decodeURIComponent(ref.slice(LB_ATT_SCHEME.length))
  } catch {
    return ''
  }
}

function attachmentFromLbAtt(ref, label, preferredKind, sortOrder = 0) {
  const attachmentId = decodeLbAttRef(ref)
  if (!attachmentId) return null
  const url = getAttachmentBlobUrl(attachmentId)
  if (!url) return null
  const mimeType =
    dbGetAttachmentType(attachmentId) ||
    (preferredKind === 'image' ? 'image/png' : 'application/octet-stream')
  const kind =
    preferredKind === 'image' || isImageMimeType(mimeType) ? 'image' : 'file'
  const parts = attachmentId.split('/')
  const id = parts[parts.length - 1] || attachmentId
  return {
    id,
    url,
    sortOrder,
    kind,
    name: String(label || '').trim(),
    mimeType,
  }
}

function extractMarkdownAttachments(content = '') {
  const text = String(content ?? '')
  if (!text.includes(LB_ATT_SCHEME)) return []

  const attachments = []
  const seen = new Set()
  let sortOrder = 0
  const imageRe = /!\[([^\]]*)\]\((lb-att:\/\/[^)]+)\)/g
  const fileRe = /(?<!!)\[([^\]]*)\]\((lb-att:\/\/[^)]+)\)/g

  let match = imageRe.exec(text)
  while (match) {
    const item = attachmentFromLbAtt(match[2], match[1], 'image', sortOrder)
    if (item && !seen.has(item.id)) {
      seen.add(item.id)
      attachments.push(item)
      sortOrder += 1
    }
    match = imageRe.exec(text)
  }

  match = fileRe.exec(text)
  while (match) {
    const item = attachmentFromLbAtt(match[2], match[1], 'file', sortOrder)
    if (item && !seen.has(item.id)) {
      seen.add(item.id)
      attachments.push(item)
      sortOrder += 1
    }
    match = fileRe.exec(text)
  }

  return attachments
}

function extractMarkdownAttachmentLabels(content = '') {
  const text = String(content ?? '')
  if (!text.includes(LB_ATT_SCHEME)) return []
  const labels = []
  const imageRe = /!\[([^\]]*)\]\((lb-att:\/\/[^)]+)\)/g
  const fileRe = /(?<!!)\[([^\]]*)\]\((lb-att:\/\/[^)]+)\)/g
  let match = imageRe.exec(text)
  while (match) {
    if (match[1]) labels.push(match[1])
    match = imageRe.exec(text)
  }
  match = fileRe.exec(text)
  while (match) {
    if (match[1]) labels.push(match[1])
    match = fileRe.exec(text)
  }
  return labels
}

function fragmentDocAttachments(doc) {
  if (!doc?.id) return []
  return blocksToAttachments(imagesToBlocks(doc.id, doc.images))
}

function introducedFragmentFileAttachments(doc, noteById) {
  const ids = Array.isArray(doc?.introducedFragmentIds)
    ? doc.introducedFragmentIds
    : []
  if (!ids.length || !noteById) return []

  const attachments = []
  const seen = new Set()
  ids.forEach((fragmentId) => {
    const note = noteById.get(String(fragmentId))
    if (!note) return
    fragmentDocAttachments(note)
      .filter((item) => item.kind === 'file')
      .forEach((item) => {
        const key = `${fragmentId}:${item.id}`
        if (seen.has(key)) return
        seen.add(key)
        attachments.push({
          ...item,
          id: key,
          sortOrder: attachments.length,
        })
      })
  })
  return attachments
}

function introducedFragmentAttachmentNames(doc, noteById) {
  const ids = Array.isArray(doc?.introducedFragmentIds)
    ? doc.introducedFragmentIds
    : []
  if (!ids.length || !noteById) return []
  const names = []
  ids.forEach((fragmentId) => {
    const note = noteById.get(String(fragmentId))
    if (!note) return
    attachmentNamesFromImages(note.images).forEach((name) => names.push(name))
  })
  return names
}

function mergeAttachments(...lists) {
  const merged = []
  const seen = new Set()
  lists.flat().forEach((item) => {
    if (!item?.url) return
    const key = String(item.id ?? item.url)
    if (seen.has(key)) return
    seen.add(key)
    merged.push({ ...item, sortOrder: merged.length })
  })
  return merged
}

function toFragmentResult(doc, tagNameById) {
  const tagName =
    (doc.tagId && tagNameById.get(String(doc.tagId))) || doc.title || ''
  const raw = doc.markdownContent || doc.rawContent || doc.summary || ''
  // 碎片直接返回全文（保留换行），不再截成 snippet
  let content = String(raw ?? '')
  content = content.replace(/```[\s\S]*?```/g, '\n')
  content = content.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  content = content.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  content = content.replace(/^#{1,6}\s+/gm, '')
  content = content.replace(/^>\s?/gm, '')
  content = content.replace(/^\s*[-+*]\s+/gm, '')
  content = content.replace(/\*\*([^*]+)\*\*/g, '$1')
  content = content.replace(/__([^_]+)__/g, '$1')
  content = content.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!content && doc.title) content = String(doc.title)

  return {
    id: doc.id,
    type: 'fragment',
    title: doc.title || tagName || '无标签',
    content,
    snippets: [],
    attachments: [],
    tagName,
    tagId: doc.tagId ?? null,
    createTime: doc.createTime || '',
    _sourceDoc: doc,
  }
}

function matchesTodoTag(todo, project, tagId) {
  if (!tagId) return true
  if (String(todo?.sourceTagId ?? '') === String(tagId)) return true
  const tagIds = Array.isArray(project?.tagIds) ? project.tagIds : []
  return tagIds.some((id) => String(id) === String(tagId))
}

function toTodoResult(todo, project, keywords = []) {
  const raw = [todo.title, todo.sourceExcerpt, todo.sourceNoteTitle, todo.doneWhen]
    .filter(Boolean)
    .join('\n')
  let snippets = buildSnippets(raw, keywords)
  if (!snippets.length && todo.title) {
    snippets = buildSnippets(todo.title, keywords)
  }
  return {
    id: todo.id,
    type: 'todo',
    todoId: todo.id,
    projectId: todo.projectId || '',
    projectName: project?.name || '未命名',
    title: todo.title || '无标题',
    doneWhen: String(todo.doneWhen || '').trim(),
    snippets,
    attachments: [],
    tagName: todo.sourceTagName || '',
    tagId: todo.sourceTagId || null,
    createTime: todo.createTime || '',
    _sourceDoc: todo,
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
    attachments: [],
    tagName,
    tagId: doc.tagId ?? null,
    createTime: doc.createTime || '',
    _sourceDoc: doc,
  }
}

function hydrateResultAttachments(item, noteById) {
  const doc = item?._sourceDoc
  if (!doc || item?.type === 'todo') {
    const { _sourceDoc, ...rest } = item || {}
    return { ...rest, attachments: Array.isArray(item?.attachments) ? item.attachments : [] }
  }

  const attachments =
    item.type === 'fragment'
      ? fragmentDocAttachments(doc)
      : mergeAttachments(
          extractMarkdownAttachments(doc.content),
          introducedFragmentFileAttachments(doc, noteById),
        )

  const { _sourceDoc, ...rest } = item
  return { ...rest, attachments }
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
  scopes = ['fragment', 'sediment', 'todo'],
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
    scopeSet.add('todo')
  }

  const tags = await listTagDocs()
  const tagNameById = new Map(tags.map((tag) => [String(tag.id), tag.tagName]))

  const results = []
  let noteById = null

  const loadNoteById = async () => {
    if (noteById) return noteById
    const noteDocs = await dbAllDocs(NOTE_PREFIX)
    noteById = new Map()
    ;(noteDocs || []).map(stripDoc).forEach((doc) => {
      if (doc?.id) noteById.set(String(doc.id), doc)
    })
    return noteById
  }

  if (scopeSet.has('fragment') || scopeSet.has('sediment')) {
    await loadNoteById()
  }

  if (scopeSet.has('fragment')) {
    const notes = noteById ? [...noteById.values()] : []
    notes
      .filter((doc) => doc?.id && !doc.deletedAt && !doc.archivedAt)
      .forEach((doc) => {
        if (!matchesTag(doc, tagId)) return
        if (!matchesDateRange(doc.createTime, dateFrom, dateTo)) return
        const haystack = buildHaystack([
          doc.title,
          doc.summary,
          doc.rawContent,
          doc.markdownContent,
          ...attachmentNamesFromImages(doc.images),
        ])
        if (!matchesKeywords(haystack, keywordList)) return
        results.push(toFragmentResult(doc, tagNameById))
      })
  }

  if (scopeSet.has('sediment')) {
    const notesMap = noteById || (await loadNoteById())
    const structDocs = await dbAllDocs(STRUCT_NOTE_PREFIX)
    ;(structDocs || [])
      .map(stripDoc)
      .filter((doc) => doc?.id && !doc.deletedAt)
      .forEach((doc) => {
        if (!matchesTag(doc, tagId)) return
        if (!matchesDateRange(doc.createTime, dateFrom, dateTo)) return
        const haystack = buildHaystack([
          doc.title,
          doc.content,
          ...extractMarkdownAttachmentLabels(doc.content),
          ...introducedFragmentAttachmentNames(doc, notesMap),
        ])
        if (!matchesKeywords(haystack, keywordList)) return
        results.push(toSedimentResult(doc, tagNameById, keywordList))
      })
  }

  if (scopeSet.has('todo')) {
    const [todoDocs, projectDocs] = await Promise.all([
      dbAllDocs(TODO_PREFIX),
      dbAllDocs(PROJECT_PREFIX),
    ])
    const projectById = new Map()
    ;(projectDocs || [])
      .map(stripDoc)
      .filter((doc) => doc?.id && !doc.deletedAt)
      .forEach((doc) => {
        projectById.set(String(doc.id), doc)
      })

    ;(todoDocs || [])
      .map(stripDoc)
      .filter((doc) => doc?.id && !doc.deletedAt)
      .forEach((doc) => {
        const project = projectById.get(String(doc.projectId || ''))
        if (!project) return
        if (!matchesTodoTag(doc, project, tagId)) return
        if (!matchesDateRange(doc.createTime, dateFrom, dateTo)) return
        const haystack = buildHaystack([
          doc.title,
          doc.sourceExcerpt,
          doc.sourceNoteTitle,
          doc.doneWhen,
          project.name,
        ])
        if (!matchesKeywords(haystack, keywordList)) return
        results.push(toTodoResult(doc, project, keywordList))
      })
  }

  results.sort((a, b) =>
    String(b.createTime || '').localeCompare(String(a.createTime || '')),
  )

  const pageData = paginate(results, page, pageSize)
  const notesMap = noteById || new Map()
  return {
    records: pageData.records.map((item) => hydrateResultAttachments(item, notesMap)),
    total: pageData.total,
    pageNo: pageData.current,
    pageSize: pageData.size,
    pages: pageData.pages,
    hasMore: pageData.current < pageData.pages,
  }
}
