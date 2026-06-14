import { unzipSync } from 'fflate'
import { saveImageFiles } from '../storage/utools/attachment'
import { NOTE_PREFIX, STRUCT_FOLDER_PREFIX, STRUCT_NOTE_PREFIX } from '../storage/utools/constants'
import { dbGet, dbPut } from '../storage/utools/dbClient'
import { pinTypeToWeight } from '../storage/utools/pin'
import { ensureTag } from '../storage/utools/tagRepository'
import { formatDateTime } from '../storage/utools/utils'
import {
  BACKUP_FORMAT,
  FRAGMENTS_DIR,
  LB_TYPE_FRAGMENT,
  LB_TYPE_SEDIMENT,
  SEDIMENT_DIR,
  isLanbitouBackup,
  joinZipPath,
  parseFrontmatter,
} from './format'

function readZipEntries(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(unzipSync(new Uint8Array(reader.result)))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}

function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

function normalizeParentId(parentId) {
  if (parentId == null || parentId === '' || parentId === 0 || parentId === '0') return null
  return String(parentId)
}

async function getDoc(prefix, id) {
  const doc = await dbGet(`${prefix}${id}`)
  if (!doc?.id && !doc?._id) return null
  return doc
}

function isIncomingNewer(incomingTime, existingTime) {
  if (!incomingTime) return false
  if (!existingTime) return true
  return String(incomingTime) > String(existingTime)
}

function collectMarkdownEntries(entries) {
  return Object.entries(entries)
    .filter(([path]) => path.endsWith('.md'))
    .map(([path, bytes]) => ({ path, bytes }))
}

function sortFoldersForCreate(folders = []) {
  const list = folders.slice()
  const created = new Set()
  const output = []
  let guard = 0

  while (list.length && guard < list.length * 4) {
    guard += 1
    const index = list.findIndex((item) => {
      const parentId = item.parentId
      if (parentId == null || parentId === '' || parentId === 0 || parentId === '0') return true
      return created.has(String(parentId))
    })
    if (index === -1) break
    const [item] = list.splice(index, 1)
    output.push(item)
    created.add(String(item.id))
  }

  return [...output, ...list]
}

async function importTags(tags = [], summary) {
  let count = 0
  for (const tag of tags) {
    const name = String(tag.tagName || '').trim()
    if (!name) continue
    await ensureTag(name)
    count += 1
  }
  summary.tags = count
}

async function importFolderTree(folders = [], summary, maps) {
  const sorted = sortFoldersForCreate(folders.filter((item) => item.type === 'folder'))
  for (const folder of sorted) {
    const folderId = String(folder.id)
    const existingFolder = await getDoc(STRUCT_FOLDER_PREFIX, folderId)
    if (existingFolder) {
      maps.folderIdMap.set(folderId, folderId)
      if (!isIncomingNewer(folder.updateTime, existingFolder.updateTime)) {
        summary.foldersSkipped += 1
        continue
      }
      summary.foldersUpdated += 1
    }
    const parentId =
      maps.folderIdMap.get(String(folder.parentId ?? '')) ?? normalizeParentId(folder.parentId)
    const now = formatDateTime()
    await dbPut({
      _id: `${STRUCT_FOLDER_PREFIX}${folderId}`,
      id: folderId,
      parentId,
      name: folder.name || '未命名文件夹',
      type: 'folder',
      noteId: null,
      sort: folder.sort ?? 0,
      createTime: folder.createTime || now,
      updateTime: folder.updateTime || now,
    })
    maps.folderIdMap.set(folderId, folderId)
    if (!existingFolder) summary.foldersAdded += 1
  }
}

async function importFragment(item, summary, maps) {
  const { meta, body } = parseFrontmatter(decodeText(item.bytes))
  if (meta.lb_type !== LB_TYPE_FRAGMENT || !meta.lb_id) return

  const noteId = String(meta.lb_id)
  maps.fragmentIdMap.set(noteId, noteId)

  const existingFragment = await getDoc(NOTE_PREFIX, noteId)
  if (existingFragment && !isIncomingNewer(meta.lb_updated, existingFragment.updateTime)) {
    summary.fragmentsSkipped += 1
    return
  }
  if (existingFragment) summary.fragmentsUpdated += 1

  const tagName = String(meta.lb_tag || '').trim()
  let tagId = null
  if (tagName) {
    const tag = await ensureTag(tagName)
    tagId = tag?.id ?? null
  }

  const now = meta.lb_created || formatDateTime()
  const imagesMeta = Array.isArray(meta.lb_images) ? meta.lb_images.slice() : []
  imagesMeta.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))

  const files = imagesMeta
    .map((img) => {
      if (!img?.file) return null
      const filePath = joinZipPath(img.file)
      const fileBytes = maps.entries[filePath]
      if (!fileBytes) return null
      return new File([fileBytes], String(img.id || 'image'), {
        type: img.mime || 'application/octet-stream',
      })
    })
    .filter(Boolean)

  let images = []
  if (files.length) {
    images = await saveImageFiles(noteId, files)
    images = images.map((img, index) => ({
      ...img,
      mimeType: imagesMeta[index]?.mime || img.mimeType,
      sortOrder: imagesMeta[index]?.sort ?? img.sortOrder ?? index,
    }))
  }

  await dbPut({
    _id: `${NOTE_PREFIX}${noteId}`,
    id: noteId,
    title: tagName || body.split('\n').find((line) => line.trim())?.slice(0, 80) || '未命名',
    fineTitle: '',
    summary: '',
    rawContent: body,
    markdownContent: body,
    tagId,
    pinWeight: pinTypeToWeight(meta.lb_pin || 'DEFAULT'),
    images,
    createTime: now,
    updateTime: meta.lb_updated || now,
    deletedAt: null,
    archivedAt: meta.lb_archived ? meta.lb_updated || now : null,
    archivedByStructNoteId: meta.lb_archived ? meta.lb_archived_by || null : null,
  })

  if (!existingFragment) summary.fragmentsAdded += 1
}

async function importSedimentNote(item, summary, maps) {
  const { meta, body } = parseFrontmatter(decodeText(item.bytes))
  if (meta.lb_type !== LB_TYPE_SEDIMENT || !meta.lb_id) return

  const noteId = String(meta.lb_id)
  const folderItemId = String(meta.lb_folder_item_id || '')

  const existingSediment = await getDoc(STRUCT_NOTE_PREFIX, noteId)
  if (existingSediment && !isIncomingNewer(meta.lb_updated, existingSediment.updateTime)) {
    summary.sedimentSkipped += 1
    return
  }
  if (existingSediment) summary.sedimentUpdated += 1

  const tagName = String(meta.lb_tag || '').trim()
  let tagId = null
  if (tagName) {
    const tag = await ensureTag(tagName)
    tagId = tag?.id ?? null
  }

  const sourceFragmentIds = (Array.isArray(meta.lb_source_fragments) ? meta.lb_source_fragments : [])
    .map((id) => maps.fragmentIdMap.get(String(id)) || String(id))
    .filter(Boolean)

  const now = meta.lb_created || formatDateTime()
  const title = String(meta.title || '无标题').trim() || '无标题'

  await dbPut({
    _id: `${STRUCT_NOTE_PREFIX}${noteId}`,
    id: noteId,
    title,
    content: body,
    tagId,
    sourceFragmentIds,
    createTime: now,
    updateTime: meta.lb_updated || now,
  })

  if (folderItemId && !(await getDoc(STRUCT_FOLDER_PREFIX, folderItemId))) {
    const folderMeta = (maps.manifest.folders || []).find((entry) => String(entry.id) === folderItemId)
    const parentId =
      maps.folderIdMap.get(String(folderMeta?.parentId ?? '')) ??
      normalizeParentId(folderMeta?.parentId)
    await dbPut({
      _id: `${STRUCT_FOLDER_PREFIX}${folderItemId}`,
      id: folderItemId,
      parentId,
      name: folderMeta?.name || title,
      type: 'note',
      noteId,
      sort: folderMeta?.sort ?? 0,
      createTime: folderMeta?.createTime || now,
      updateTime: folderMeta?.updateTime || now,
    })
    maps.folderIdMap.set(folderItemId, folderItemId)
  }

  if (!existingSediment) summary.sedimentAdded += 1
}

export async function importLanbitouBackup(file) {
  const entries = await readZipEntries(file)
  const entryNames = Object.keys(entries)
  if (!isLanbitouBackup(entryNames)) {
    throw new Error('不是有效的烂笔头备份包')
  }

  const manifest = JSON.parse(decodeText(entries['manifest.json']))
  if (manifest.format !== BACKUP_FORMAT) {
    throw new Error('备份格式不受支持')
  }

  const tags = entries['tags.json'] ? JSON.parse(decodeText(entries['tags.json'])) : []
  const summary = {
    fragmentsAdded: 0,
    fragmentsUpdated: 0,
    fragmentsSkipped: 0,
    foldersAdded: 0,
    foldersUpdated: 0,
    foldersSkipped: 0,
    sedimentAdded: 0,
    sedimentUpdated: 0,
    sedimentSkipped: 0,
    tags: 0,
    errors: [],
  }

  const maps = {
    entries,
    manifest,
    fragmentIdMap: new Map(),
    folderIdMap: new Map(),
  }

  await importTags(tags, summary)
  await importFolderTree(manifest.folders || [], summary, maps)

  const markdownEntries = collectMarkdownEntries(entries)

  for (const item of markdownEntries) {
    if (!item.path.startsWith(`${FRAGMENTS_DIR}/`)) continue
    try {
      await importFragment(item, summary, maps)
    } catch (error) {
      summary.errors.push({ path: item.path, message: error?.message || '碎片导入失败' })
    }
  }

  for (const item of markdownEntries) {
    if (!item.path.startsWith(`${SEDIMENT_DIR}/`)) continue
    try {
      await importSedimentNote(item, summary, maps)
    } catch (error) {
      summary.errors.push({ path: item.path, message: error?.message || '沉淀导入失败' })
    }
  }

  return summary
}
