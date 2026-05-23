import { post, get, postForm, resolveResourceUrl } from './http'

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
    images: mapBlockResources(item.blocks),
  }
}

export async function fetchBlockListByDate(currentDate) {
  let date = currentDate
  if (!date) {
    date = formatDateParam(new Date())
  } else if (date instanceof Date) {
    date = formatDateParam(date)
  }

  const params = { date }
  const data = await get('/api/note/listByDay', params)
  return Array.isArray(data) ? data.map(mapBlockToNote) : []
}

export async function createBlock(content, images = [], onProgress) {
  if (!images || images.length === 0) {
    const data = await post('/api/note/insert', { rawContent: content })
    return data
  }

  const form = new FormData()
  form.append('rawContent', content ?? '')
  images.forEach((file, index) => {
    const filename = file.name || `image_${index}.png`
    form.append('images', file, filename)
  })

  return postForm('/api/note/insert', form, { onProgress })
}

/**
 * 更新笔记。无图片变更时走 JSON；有图片变更时：
 * - 仅调整/删除已有图：JSON 带 retainedImageIds
 * - 含新上传文件：multipart，字段 id、title、content、retainedImageIds（JSON 字符串）、images（文件，与 insert 一致）
 */
export async function updateBlock(
  id,
  title,
  content,
  { retainedImageIds, newImages = [], onProgress } = {},
) {
  const files = Array.isArray(newImages) ? newImages.filter(Boolean) : []
  const hasImageMutation =
    Array.isArray(retainedImageIds) || files.length > 0

  if (!hasImageMutation) {
    const data = await post('/api/note/update', { id, title, content })
    return data
  }

  if (files.length === 0) {
    const data = await post('/api/note/update', {
      id,
      title,
      content,
      retainedImageIds: Array.isArray(retainedImageIds)
        ? retainedImageIds
        : [],
    })
    return data
  }

  const form = new FormData()
  form.append('id', String(id))
  form.append('title', title ?? '')
  form.append('content', content ?? '')
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
  return get('/api/note/delete', { id })
}

export async function setPinBlock(id, pinWeightValue) {
  const data = await post('/api/note/setPin', { id, pinWeightValue })
  return data
}

export async function searchNotes({ keyword, page = 1, size = 20 } = {}) {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const safeSize = Math.min(
    Math.max(Number.isFinite(size) ? Math.floor(size) : 20, 1),
    50,
  )
  const data = await get('/api/note/search', {
    keyword: (keyword ?? '').trim(),
    page: safePage,
    size: safeSize,
  })
  return {
    total: data?.total ?? 0,
    page: data?.page ?? safePage,
    size: data?.size ?? safeSize,
    list: Array.isArray(data?.list) ? data.list.map(mapBlockToNote) : [],
  }
}

export async function fetchRecycleList() {
  const data = await get('/api/note/recycle/list')
  return Array.isArray(data) ? data.map(mapBlockToNote) : []
}

export async function restoreRecycleNote(id) {
  return get('/api/note/recycle/restore', { id })
}

export async function deleteRecycleForever(id) {
  return get('/api/note/recycle/deleteForever', { id })
}
