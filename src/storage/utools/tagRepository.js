import { NOTE_PREFIX, TAG_PREFIX } from './constants'
import { dbAllDocs, dbGet, dbPut, dbRemove } from './dbClient'
import { createId, formatDateTime } from './utils'

function tagDocId(id) {
  return `${TAG_PREFIX}${id}`
}

function stripTagDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

async function saveTagDoc(doc) {
  const payload = { ...doc, _id: tagDocId(doc.id) }
  await dbPut(payload)
  return doc
}

export async function listTagDocs() {
  const docs = await dbAllDocs(TAG_PREFIX)
  return (docs || []).map(stripTagDoc).filter((doc) => doc?.id && doc.tagName)
}

export async function getAllTagNames() {
  const tags = await listTagDocs()
  return tags
    .map((tag) => String(tag.tagName).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/** 供 AI 选标：标签库 + 历史笔记标题去重 */
export async function getAllTagNamesForAi() {
  const names = new Set(await getAllTagNames())
  const noteDocs = await dbAllDocs(NOTE_PREFIX)
  ;(noteDocs || []).forEach((doc) => {
    const title = String(doc?.title || '').trim()
    if (title) names.add(title)
  })
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function normalizeTagName(tagName) {
  return String(tagName ?? '').trim()
}

export async function getTagById(tagId) {
  const id = String(tagId ?? '').trim()
  if (!id) return null
  const raw = await dbGet(tagDocId(id))
  const doc = stripTagDoc(raw)
  return doc?.id ? doc : null
}

export async function findTagByName(tagName) {
  const name = normalizeTagName(tagName)
  if (!name) return null
  const tags = await listTagDocs()
  return tags.find((tag) => tag.tagName === name) ?? null
}

export async function ensureTag(tagName) {
  const name = normalizeTagName(tagName)
  if (!name) return null

  const existing = await findTagByName(name)
  if (existing) return existing

  const doc = {
    id: createId(),
    tagName: name,
    createTime: formatDateTime(),
  }
  await saveTagDoc(doc)
  return doc
}

export async function createTag(tagName) {
  const name = normalizeTagName(tagName)
  if (!name) {
    throw new Error('标签名称不能为空')
  }
  if (name.length > 5) {
    throw new Error('标签名称不能超过 5 个字')
  }

  const existing = await findTagByName(name)
  if (existing) {
    return {
      tagId: existing.id,
      tagName: existing.tagName,
      noteCount: '0',
    }
  }

  const doc = await ensureTag(name)
  return {
    tagId: doc.id,
    tagName: doc.tagName,
    noteCount: '0',
  }
}

export async function updateTagDoc(tagId, nextName) {
  const name = normalizeTagName(nextName)
  if (!name) throw new Error('标签名称不能为空')
  if (name.length > 5) throw new Error('标签名称不能超过 5 个字')

  const doc = await getTagById(tagId)
  if (!doc) throw new Error('标签不存在')

  const duplicate = await findTagByName(name)
  if (duplicate && String(duplicate.id) !== String(doc.id)) {
    throw new Error('标签名称已存在')
  }

  doc.tagName = name
  doc.updateTime = formatDateTime()
  await saveTagDoc(doc)
  return doc
}

export async function removeTagDoc(tagId) {
  const raw = await dbGet(tagDocId(tagId))
  if (!raw?._id) throw new Error('标签不存在')
  await dbRemove({ _id: raw._id, _rev: raw._rev })
  return true
}

export async function resolveTagForTitle(title) {
  const name = normalizeTagName(title)
  if (!name) {
    return { tagId: null, tagName: '' }
  }
  const tag = await ensureTag(name)
  return { tagId: tag.id, tagName: tag.tagName }
}

export async function listTagsWithCounts(countByTagId = new Map(), nameByTagId = new Map()) {
  const tags = await listTagDocs()
  const map = new Map()

  tags.forEach((tag) => {
    map.set(String(tag.id), {
      tagId: tag.id,
      tagName: tag.tagName,
      noteCount: countByTagId.get(String(tag.id)) ?? 0,
    })
  })

  countByTagId.forEach((count, tagId) => {
    if (map.has(tagId)) return
    map.set(tagId, {
      tagId,
      tagName: nameByTagId.get(tagId) || tagId,
      noteCount: count,
    })
  })

  return [...map.values()]
    .sort((a, b) => b.noteCount - a.noteCount || a.tagName.localeCompare(b.tagName, 'zh-CN'))
    .map((item) => ({
      tagId: item.tagId,
      tagName: item.tagName,
      noteCount: String(item.noteCount),
    }))
}
