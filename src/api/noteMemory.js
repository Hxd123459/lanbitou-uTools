import { get, resolveResourceUrl } from './http'

function mapBlockResources(blocks) {
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

/**
 * 获取回响笔记
 * @param {number|string} aiNoteRecallId
 */
export async function fetchNoteRecall(aiNoteRecallId) {
  const data = await get('/note/memory/recall', { aiNoteRecallId })
  return {
    id: data.id,
    title: data.title || '',
    recallText: data.recallText || '',
    markdownContent: data.markdownContent || '',
    createTime: data.createTime,
    beforeDays: Number(data.beforeDays) || 0,
    images: mapBlockResources(data.blocks),
  }
}

/**
 * 记录回响点击（展开）
 * @param {number|string} aiNoteRecallId
 */
export function clickNoteMemory(aiNoteRecallId) {
  return get('/note/memory/click', { aiNoteRecallId })
}
