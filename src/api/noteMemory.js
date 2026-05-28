import { get } from './http'

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
  }
}
