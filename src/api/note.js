import { post, get } from './http'

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

function mapBlockToNote(item) {
  return {
    id: item.id,
    title: item.title || '',
    fineTitle: item.fineTitle || '',
    text: item.originalContent || '',
    updateContent: item.updateContent || '',
    createdAt: item.createTime,
    tokenUsage: item.tokenUsage,
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

export async function createBlock(content) {
  const data = await post('/api/note/insert', { original_content: content })
  return data
}

export async function updateBlock(id, title, content) {
  const data = await post('/api/note/update', { id, title, content })
  return data
}

export async function deleteBlock(id) {
  return get('/api/note/delete', { id })
}
