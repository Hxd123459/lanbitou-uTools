import { isUtoolsMode } from '../storage/env'
import { get } from './http'
import { mapBlockImages } from './note'
import { dbAllDocs } from '../storage/utools/dbClient'
import { NOTE_PREFIX } from '../storage/utools/constants'
import { imagesToBlocks } from '../storage/utools/attachment'
import { datePartFromDateTime } from '../storage/utools/utils'

async function findLocalRecallNote(aiNoteRecallId) {
  const docs = await dbAllDocs(NOTE_PREFIX)
  const target = (docs || []).find((doc) => String(doc.id) === String(aiNoteRecallId))
  if (!target || target.deletedAt) return null

  const createDate = datePartFromDateTime(target.createTime)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const noteDate = new Date(`${createDate}T00:00:00`)
  const beforeDays = Math.max(
    0,
    Math.floor((today.getTime() - noteDate.getTime()) / (24 * 60 * 60 * 1000)),
  )

  return {
    id: target.id,
    title: target.title || '',
    recallText: `这是 ${beforeDays} 天前留下的笔记。`,
    markdownContent: target.markdownContent || target.rawContent || '',
    createTime: target.createTime,
    beforeDays,
    blocks: imagesToBlocks(target.id, target.images),
  }
}

export async function fetchNoteRecall(aiNoteRecallId) {
  if (isUtoolsMode()) {
    const data = await findLocalRecallNote(aiNoteRecallId)
    if (!data) {
      throw new Error('回响笔记不存在')
    }
    return {
      ...data,
      images: mapBlockImages(data.blocks),
    }
  }

  const data = await get('/note/memory/recall', { aiNoteRecallId })
  return {
    id: data.id,
    title: data.title || '',
    recallText: data.recallText || '',
    markdownContent: data.markdownContent || '',
    createTime: data.createTime,
    beforeDays: Number(data.beforeDays) || 0,
    images: mapBlockImages(data.blocks),
  }
}

export function clickNoteMemory(aiNoteRecallId) {
  if (isUtoolsMode()) {
    return Promise.resolve(true)
  }
  return get('/note/memory/click', { aiNoteRecallId })
}
