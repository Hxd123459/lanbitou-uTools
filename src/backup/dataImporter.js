import { unzipSync } from 'fflate'
import { isImageMimeType } from '../constants/uploadLimits'
import {
  buildAttachmentId,
  saveImageFiles,
  removeAttachments,
} from '../storage/utools/attachment'
import { NOTE_PREFIX, STRUCT_FOLDER_PREFIX, STRUCT_NOTE_PREFIX } from '../storage/utools/constants'
import { dbGet, dbPostAttachment, dbPut } from '../storage/utools/dbClient'
import { pinTypeToWeight } from '../storage/utools/pin'
import { ensureTag } from '../storage/utools/tagRepository'
import { formatDateTime } from '../storage/utools/utils'
import {
  ATTACHMENTS_DIR,
  BACKUP_FORMAT,
  FRAGMENTS_DIR,
  LB_TYPE_FRAGMENT,
  LB_TYPE_SEDIMENT,
  SEDIMENT_DIR,
  extensionToMime,
  isLanbitouBackup,
  joinZipPath,
  mimeToExtension,
  normalizeBackupAttachmentMeta,
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

function normalizeZipEntryKey(key) {
  const text = String(key ?? '').replace(/\\/g, '/').replace(/^\/+/, '')
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

function buildZipEntryIndex(entries) {
  const index = {}
  Object.entries(entries || {}).forEach(([key, bytes]) => {
    const normalized = normalizeZipEntryKey(key)
    index[normalized] = bytes
    for (const rootDir of [FRAGMENTS_DIR, SEDIMENT_DIR]) {
      if (!normalized.startsWith(`${rootDir}/`)) {
        index[joinZipPath(rootDir, normalized)] = bytes
      }
    }
  })
  return index
}

function lookupZipEntry(entryIndex, filePath) {
  const normalized = joinZipPath(filePath)
  if (entryIndex[normalized]) return entryIndex[normalized]

  const basename = normalized.split('/').pop()
  if (!basename) return null

  for (const [key, bytes] of Object.entries(entryIndex)) {
    if (key === basename || key.endsWith(`/${basename}`)) return bytes
  }
  return null
}

function splitLegacyAttachmentMeta(imagesMeta = [], filesMeta = []) {
  if (filesMeta.length) {
    return {
      images: normalizeBackupAttachmentMeta(imagesMeta),
      files: normalizeBackupAttachmentMeta(filesMeta),
    }
  }
  const normalized = normalizeBackupAttachmentMeta(imagesMeta)
  return {
    images: normalized.filter((item) => isImageMimeType(item.mime)),
    files: normalized.filter((item) => !isImageMimeType(item.mime)),
  }
}

function discoverAttachmentEntries(entryIndex, noteId, imagesMeta = [], filesMeta = [], baseDir) {
  const { images: normalizedImages, files: normalizedFiles } = splitLegacyAttachmentMeta(
    imagesMeta,
    filesMeta,
  )
  if (normalizedImages.length || normalizedFiles.length) {
    return [...normalizedImages, ...normalizedFiles].sort(
      (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
    )
  }

  const prefix = `${joinZipPath(baseDir, ATTACHMENTS_DIR, noteId)}/`
  const discovered = []

  for (const [key] of Object.entries(entryIndex)) {
    const normalized = normalizeZipEntryKey(key)
    if (!normalized.startsWith(prefix)) continue
    const filename = normalized.slice(prefix.length)
    if (!filename || filename.includes('/')) continue
    const dot = filename.lastIndexOf('.')
    const assetId = dot > 0 ? filename.slice(0, dot) : filename
    const ext = dot > 0 ? filename.slice(dot + 1) : ''
    discovered.push({
      id: assetId,
      file: normalized,
      mime: extensionToMime(ext),
      sort: discovered.length,
      name: '',
    })
  }

  return discovered.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
}

function discoverFragmentAttachments(entryIndex, noteId, imagesMeta = [], filesMeta = []) {
  return discoverAttachmentEntries(entryIndex, noteId, imagesMeta, filesMeta, FRAGMENTS_DIR)
}

function discoverSedimentAttachments(entryIndex, noteId, imagesMeta = [], filesMeta = []) {
  return discoverAttachmentEntries(entryIndex, noteId, imagesMeta, filesMeta, SEDIMENT_DIR)
}

function buildAttachmentFiles(entryIndex, noteId, attachmentsMeta = [], baseDir) {
  return attachmentsMeta
    .map((item) => {
      const ext = mimeToExtension(item.mime || item.mimeType, item.name)
      const candidates = [
        item.file,
        joinZipPath(baseDir, ATTACHMENTS_DIR, noteId, `${item.id}.${ext}`),
      ]

      let fileBytes = null
      for (const candidate of candidates) {
        if (!candidate) continue
        fileBytes = lookupZipEntry(entryIndex, candidate)
        if (fileBytes) break
      }
      if (!fileBytes) return null

      const bytes = normalizeImageBytes(fileBytes)
      if (!bytes?.length) return null

      const fallbackName = `${item.id || 'attachment'}.${ext}`
      const fileName = String(item.name || item.fileName || fallbackName).trim() || fallbackName
      return new File([bytes], fileName, {
        type: item.mime || item.mimeType || 'application/octet-stream',
      })
    })
    .filter(Boolean)
}

async function restoreNoteAttachments(entryIndex, noteId, imagesMeta = [], filesMeta = [], baseDir) {
  const attachmentsMeta = discoverAttachmentEntries(
    entryIndex,
    noteId,
    imagesMeta,
    filesMeta,
    baseDir,
  )
  for (const item of attachmentsMeta) {
    if (!item?.id) continue
    const ext = mimeToExtension(item.mime || item.mimeType, item.name)
    const candidates = [
      item.file,
      joinZipPath(baseDir, ATTACHMENTS_DIR, noteId, `${item.id}.${ext}`),
    ]
    let fileBytes = null
    for (const candidate of candidates) {
      if (!candidate) continue
      fileBytes = lookupZipEntry(entryIndex, candidate)
      if (fileBytes) break
    }
    const bytes = normalizeImageBytes(fileBytes)
    if (!bytes?.length) continue
    const attachmentId = buildAttachmentId(noteId, item.id)
    dbPostAttachment(attachmentId, bytes, item.mime || 'application/octet-stream')
  }
}

function normalizeImageBytes(bytes) {
  if (!bytes) return null
  if (bytes instanceof Uint8Array) return bytes
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
  if (typeof bytes.length === 'number') return new Uint8Array(bytes)
  return null
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
  const attachmentsMeta = discoverFragmentAttachments(
    maps.entryIndex,
    noteId,
    Array.isArray(meta.lb_images) ? meta.lb_images : [],
    Array.isArray(meta.lb_files) ? meta.lb_files : [],
  )
  const attachmentFiles = buildAttachmentFiles(
    maps.entryIndex,
    noteId,
    attachmentsMeta,
    FRAGMENTS_DIR,
  )

  let images = []
  if (attachmentFiles.length) {
    if (existingFragment?.images?.length) {
      await removeAttachments(existingFragment.images)
    }
    images = await saveImageFiles(noteId, attachmentFiles)
    images = images.map((img, index) => ({
      ...img,
      mimeType: attachmentsMeta[index]?.mime || img.mimeType,
      fileName: attachmentsMeta[index]?.name || img.fileName || attachmentFiles[index]?.name || '',
      sortOrder: attachmentsMeta[index]?.sort ?? img.sortOrder ?? index,
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

  const introducedFragmentIds = (
    Array.isArray(meta.lb_introduced_fragments) ? meta.lb_introduced_fragments : []
  )
    .map((id) => maps.fragmentIdMap.get(String(id)) || String(id))
    .filter(Boolean)

  const now = meta.lb_created || formatDateTime()
  const title = String(meta.title || '无标题').trim() || '无标题'

  await restoreNoteAttachments(
    maps.entryIndex,
    noteId,
    Array.isArray(meta.lb_images) ? meta.lb_images : [],
    Array.isArray(meta.lb_files) ? meta.lb_files : [],
    SEDIMENT_DIR,
  )

  await dbPut({
    _id: `${STRUCT_NOTE_PREFIX}${noteId}`,
    id: noteId,
    title,
    content: body,
    tagId,
    sourceFragmentIds,
    introducedFragmentIds,
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
    entryIndex: buildZipEntryIndex(entries),
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
