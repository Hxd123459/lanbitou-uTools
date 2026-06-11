import { isUtoolsMode } from '../storage/env'
import * as utoolsNote from '../storage/utools/noteRepository'
import * as utoolsStruct from '../storage/utools/structRepository'
import { ApiError, post, get, postForm, resolveResourceUrl } from './http'

export function formatDateParam(date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDateString(dateString, offsetDays) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + offsetDays)
  return formatDateParam(date)
}

export function mapBlockResources(blocks) {
  if (!Array.isArray(blocks)) return []
  return blocks
    .filter((b) => b && b.type === 'image' && b.fileUrl)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((b) => ({
      id: b.id,
      url: resolveResourceUrl(b.fileUrl),
      sortOrder: b.sortOrder ?? 0,
    }))
}

function mapBlockToNote(item) {
  return {
    id: item.id,
    title: item.title || '',
    fineTitle: item.fineTitle || '',
    summary: item.summary || '',
    text: item.rawContent || '',
    markdownContent: item.markdownContent || '',
    createdAt: item.createTime,
    tokenUsage: item.tokenUsage,
    pinWeightType: item.pinWeightType || 'DEFAULT',
    aiNoteRecallId: item.aiNoteRecallId ?? null,
    images: mapBlockResources(item.blocks),
  }
}

export const NOTE_LIST_PAGE_SIZE = 20

function normalizePageNo(pageNo) {
  return Number.isFinite(pageNo) && pageNo >= 1 ? Math.floor(pageNo) : 1
}

function normalizePageSize(pageSize) {
  const fallback = NOTE_LIST_PAGE_SIZE
  return Math.min(
    Math.max(Number.isFinite(pageSize) ? Math.floor(pageSize) : fallback, 1),
    50,
  )
}

function parseBlockListPage(data, pageNo, pageSize) {
  let rawList = []
  let total = null
  let resolvedPageNo = pageNo
  let resolvedPageSize = pageSize
  let totalPages = null

  if (Array.isArray(data)) {
    rawList = data
  } else if (data && typeof data === 'object') {
    rawList = data.records ?? data.list ?? data.rows ?? []
    total = data.total ?? data.totalCount ?? data.count ?? null
    resolvedPageNo = data.current ?? data.pageNo ?? data.page ?? pageNo
    resolvedPageSize = data.size ?? data.pageSize ?? pageSize
    totalPages = data.pages ?? data.totalPages ?? null
  }

  const list = Array.isArray(rawList) ? rawList.map(mapBlockToNote) : []
  const safePageNo = normalizePageNo(resolvedPageNo)
  const safePageSize = normalizePageSize(resolvedPageSize)
  const totalNum =
    total != null && Number.isFinite(Number(total)) ? Number(total) : null
  const pagesNum =
    totalPages != null && Number.isFinite(Number(totalPages))
      ? Number(totalPages)
      : null

  const hasMore =
    pagesNum != null
      ? safePageNo < pagesNum
      : totalNum != null
        ? safePageNo * safePageSize < totalNum
        : list.length >= safePageSize

  return {
    list,
    total: totalNum ?? list.length,
    pageNo: safePageNo,
    pageSize: safePageSize,
    pages: pagesNum,
    hasMore,
  }
}

export async function fetchNoteList({
  pageNo = 1,
  pageSize = NOTE_LIST_PAGE_SIZE,
} = {}) {
  const safePageNo = normalizePageNo(pageNo)
  const safePageSize = normalizePageSize(pageSize)

  if (isUtoolsMode()) {
    const data = await utoolsNote.listByDay({
      pageNo: safePageNo,
      pageSize: safePageSize,
    })
    return parseBlockListPage(data, safePageNo, safePageSize)
  }

  const data = await post('/api/note/listByDay', {
    date: null,
    tagId: null,
    pageNo: safePageNo,
    pageSize: safePageSize,
  })
  return parseBlockListPage(data, safePageNo, safePageSize)
}

export async function fetchBlockListByDate(
  currentDate,
  tagId = null,
  { pageNo = 1, pageSize = NOTE_LIST_PAGE_SIZE } = {},
) {
  let date = currentDate
  if (!date) {
    date = formatDateParam(new Date())
  } else if (date instanceof Date) {
    date = formatDateParam(date)
  }

  const safePageNo = normalizePageNo(pageNo)
  const safePageSize = normalizePageSize(pageSize)

  if (isUtoolsMode()) {
    const data = await utoolsNote.listByDay({
      date: tagId != null && tagId !== '' ? undefined : date,
      tagId,
      pageNo: safePageNo,
      pageSize: safePageSize,
    })
    return parseBlockListPage(data, safePageNo, safePageSize)
  }

  const body = {
    date,
    tagId:
      tagId != null && tagId !== '' && Number.isFinite(Number(tagId))
        ? Number(tagId)
        : null,
    pageNo: safePageNo,
    pageSize: safePageSize,
  }
  const data = await post('/api/note/listByDay', body)
  return parseBlockListPage(data, safePageNo, safePageSize)
}

export async function createBlock(content, images = [], onProgress, options = {}) {
  if (isUtoolsMode()) {
    return utoolsNote.insertNote(content, images, onProgress, options)
  }

  const { tagId, tagName } = options
  const payload = { rawContent: content }
  if (tagId != null) payload.tagId = tagId
  if (tagName) payload.tagName = tagName

  if (!images || images.length === 0) {
    const data = await post('/api/note/insert', payload)
    return data
  }

  const form = new FormData()
  form.append('rawContent', content ?? '')
  if (tagId != null) form.append('tagId', String(tagId))
  if (tagName) form.append('tagName', tagName)
  images.forEach((file, index) => {
    const filename = file.name || `image_${index}.png`
    form.append('images', file, filename)
  })

  return postForm('/api/note/insert', form, { onProgress })
}

export async function updateBlock(
  id,
  title,
  content,
  { retainedImageIds, newImages = [], onProgress, tagId, tagName } = {},
) {
  const resolvedTitle = tagName ?? title ?? ''

  if (isUtoolsMode()) {
    return utoolsNote.updateNote(id, resolvedTitle, content, {
      tagId,
      tagName: resolvedTitle,
      retainedImageIds,
      newImages,
      onProgress,
    })
  }

  const files = Array.isArray(newImages) ? newImages.filter(Boolean) : []
  const hasImageMutation =
    Array.isArray(retainedImageIds) || files.length > 0

  const basePayload = { id, title: resolvedTitle, content }
  if (tagId != null) basePayload.tagId = tagId

  if (!hasImageMutation) {
    const data = await post('/api/note/update', basePayload)
    return data
  }

  if (files.length === 0) {
    const data = await post('/api/note/update', {
      ...basePayload,
      retainedImageIds: Array.isArray(retainedImageIds)
        ? retainedImageIds
        : [],
    })
    return data
  }

  const form = new FormData()
  form.append('id', String(id))
  form.append('title', resolvedTitle)
  form.append('content', content ?? '')
  if (tagId != null) form.append('tagId', String(tagId))
  if (Array.isArray(retainedImageIds)) {
    form.append('retainedImageIds', JSON.stringify(retainedImageIds))
  }
  files.forEach((file, index) => {
    const filename = file.name || `image_${index}.png`
    form.append('images', file, filename)
  })

  return postForm('/api/note/update', form, { onProgress })
}

export async function deleteBlock(id) {
  if (isUtoolsMode()) {
    return utoolsNote.deleteNoteToRecycle(id)
  }
  return get('/api/note/delete', { id })
}

export async function moveBlocksToSediment(ids, parentId = 0) {
  const idList = (Array.isArray(ids) ? ids : [ids]).filter((id) => id != null)
  if (!idList.length) return []
  if (isUtoolsMode()) {
    return utoolsNote.moveToSediment(idList, parentId)
  }
  return post('/api/note/moveToSediment', { ids: idList, parentId })
}

export async function fetchNotesByIds(ids = []) {
  if (!isUtoolsMode()) return []
  const list = await utoolsNote.getNotesByIds(ids)
  return list.map((item) => ({
    id: item.id,
    title: item.title || '',
    fineTitle: item.fineTitle || '',
    summary: item.summary || '',
    text: item.rawContent || item.markdownContent || '',
    markdownContent: item.markdownContent || '',
    createdAt: item.createTime,
    tagId: item.tagId ?? null,
    pinWeightType: item.pinWeightType || 'DEFAULT',
    images: mapBlockResources(item.blocks),
  }))
}

export async function archiveFragmentNotes(fragmentIds, structNoteId) {
  if (!isUtoolsMode()) return []
  return utoolsNote.archiveFragmentsForStructNote(fragmentIds, structNoteId)
}

export async function restoreArchivedFragment(fragmentId, structNoteId = null) {
  if (!isUtoolsMode()) {
    throw new Error('当前环境不支持还原碎片')
  }
  const item = await utoolsNote.restoreFragmentFromArchive(fragmentId)
  if (structNoteId) {
    await utoolsStruct.removeSourceFragmentFromStructNote(structNoteId, fragmentId)
  }
  return {
    id: item.id,
    title: item.title || '',
    text: item.rawContent || item.markdownContent || '',
    markdownContent: item.markdownContent || '',
    createdAt: item.createTime,
    tagId: item.tagId ?? null,
    pinWeightType: item.pinWeightType || 'DEFAULT',
    images: mapBlockResources(item.blocks),
  }
}

export async function setPinBlock(id, pinWeightValue) {
  if (isUtoolsMode()) {
    return utoolsNote.setPin(id, pinWeightValue)
  }
  const data = await post('/api/note/setPin', { id, pinWeightValue })
  return data
}

export async function searchNotes({
  keyword,
  page = 1,
  pageSize = NOTE_LIST_PAGE_SIZE,
} = {}) {
  const safePage = normalizePageNo(page)
  const safeSize = normalizePageSize(pageSize)

  if (isUtoolsMode()) {
    const data = await utoolsNote.search(keyword, safePage, safeSize)
    return parseBlockListPage(data, safePage, safeSize)
  }

  const data = await get('/api/note/search', {
    keyword: (keyword ?? '').trim(),
    page: safePage,
    size: safeSize,
  })
  return parseBlockListPage(data, safePage, safeSize)
}

export async function fetchRecycleList() {
  if (isUtoolsMode()) {
    const data = await utoolsNote.listRecycle()
    return Array.isArray(data) ? data.map(mapBlockToNote) : []
  }
  const data = await get('/api/note/recycle/list')
  return Array.isArray(data) ? data.map(mapBlockToNote) : []
}

export async function restoreRecycleNote(id) {
  if (isUtoolsMode()) {
    return utoolsNote.restoreRecycle(id)
  }
  return get('/api/note/recycle/restore', { id })
}

export async function deleteRecycleForever(ids) {
  const idList = (Array.isArray(ids) ? ids : [ids]).filter((id) => id != null)
  if (!idList.length) return null
  if (isUtoolsMode()) {
    return utoolsNote.deleteForever(idList)
  }
  return get('/api/note/recycle/deleteForever', { ids: idList.join(',') })
}

export async function fetchAllTags() {
  if (isUtoolsMode()) {
    return utoolsNote.allTags()
  }
  const data = await get('/api/note/allTags')
  return Array.isArray(data) ? data : []
}

export async function createTag(tagName) {
  if (isUtoolsMode()) {
    return utoolsNote.createTag(tagName)
  }
  throw new ApiError('NOT_SUPPORTED', '当前环境请通过记录笔记自动生成标签')
}

export async function updateTag(tagId, tagName) {
  if (isUtoolsMode()) {
    return utoolsNote.updateTag(tagId, tagName)
  }
  throw new ApiError('NOT_SUPPORTED', '当前环境不支持修改标签')
}

export async function deleteTag(tagId) {
  if (isUtoolsMode()) {
    return utoolsNote.deleteTag(tagId)
  }
  throw new ApiError('NOT_SUPPORTED', '当前环境不支持删除标签')
}

export async function fetchNotesByTag(tagId, pagination = {}) {
  return fetchBlockListByDate(undefined, tagId, pagination)
}
