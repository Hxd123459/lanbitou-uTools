import { post } from './http'

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
    text: item.content || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    type: item.type,
    source: item.source,
    summary: item.summary,
  }
}

export async function fetchBlockListByDate(currentDate) {
  const body = currentDate ? { currentDate } : {}
  const data = await post('/api/block/listByDate', body)
  return Array.isArray(data) ? data.map(mapBlockToNote) : []
}

export async function createBlock(content) {
  const data = await post('/api/block/create', { content })
  return data
}
