import { zipSync } from 'fflate'
import { buildAttachmentId } from '../storage/utools/attachment'
import {
  ATTACHMENT_PREFIX,
  NOTE_PREFIX,
  STRUCT_FOLDER_PREFIX,
  STRUCT_NOTE_PREFIX,
} from '../storage/utools/constants'
import {
  dbAllDocs,
  dbGet,
  dbGetAttachmentAsync,
  dbGetAttachmentTypeAsync,
} from '../storage/utools/dbClient'
import { pinWeightToType } from '../storage/utools/pin'
import { listTagDocs } from '../storage/utools/tagRepository'
import {
  ATTACHMENTS_DIR,
  BACKUP_FORMAT,
  FRAGMENTS_DIR,
  LB_TYPE_FRAGMENT,
  LB_TYPE_SEDIMENT,
  LB_VERSION,
  SEDIMENT_DIR,
  joinZipPath,
  mimeToExtension,
  serializeFrontmatter,
} from './format'

function stripDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

function resolveNoteId(doc) {
  if (doc?.id != null && doc.id !== '') return String(doc.id)
  const rawId = String(doc?._id || '')
  if (rawId.startsWith(NOTE_PREFIX)) {
    return rawId.slice(NOTE_PREFIX.length)
  }
  return ''
}

function buildFolderPath(folderId, folderById) {
  const parts = []
  let current = folderById.get(String(folderId))
  let guard = 0
  while (current && guard < 64) {
    if (current.type === 'folder') {
      parts.unshift(current.name || current.id)
    }
    const parentId = current.parentId
    current = parentId != null ? folderById.get(String(parentId)) : null
    guard += 1
  }
  return parts.join('/')
}

async function loadNotes({ includeDeleted = false, includeArchived = false } = {}) {
  const docs = await dbAllDocs(NOTE_PREFIX)
  const notes = []

  for (const rawDoc of docs || []) {
    const noteId = resolveNoteId(rawDoc)
    if (!noteId) continue

    const fullDoc = stripDoc(await dbGet(`${NOTE_PREFIX}${noteId}`))
    if (!fullDoc) continue

    const doc = { ...fullDoc, id: noteId }
    if (!includeDeleted && doc.deletedAt) continue
    if (!includeArchived && doc.archivedAt) continue

    notes.push(doc)
  }

  return notes
}

async function loadStructNotes() {
  const docs = await dbAllDocs(STRUCT_NOTE_PREFIX)
  return (docs || []).map(stripDoc).filter((doc) => doc?.id)
}

async function loadFolders() {
  const docs = await dbAllDocs(STRUCT_FOLDER_PREFIX)
  return (docs || []).map(stripDoc).filter((doc) => doc?.id)
}

function normalizeAttachmentBytes(bytes) {
  if (!bytes) return null
  if (bytes instanceof Uint8Array) return bytes
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
  if (Array.isArray(bytes)) return new Uint8Array(bytes)
  if (typeof bytes.length === 'number') return new Uint8Array(bytes)
  return null
}

function resolveImageEntry(noteId, img, mimeType = '') {
  let imageId = img?.id != null && img.id !== '' ? String(img.id) : ''
  let attachmentId =
    img?.attachmentId != null && img.attachmentId !== '' ? String(img.attachmentId) : ''

  if (!attachmentId && imageId) {
    attachmentId = buildAttachmentId(noteId, imageId)
  }
  if (!imageId && attachmentId) {
    const prefix = `${ATTACHMENT_PREFIX}${noteId}/`
    if (attachmentId.startsWith(prefix)) {
      imageId = attachmentId.slice(prefix.length)
    }
  }
  if (!imageId || !attachmentId) return null

  return {
    imageId,
    attachmentId,
    mimeType: mimeType || img?.mimeType || 'application/octet-stream',
    sortOrder: img?.sortOrder ?? 0,
  }
}

async function resolveNoteImages(note) {
  const noteId = String(note.id)
  const images = Array.isArray(note.images) ? [...note.images] : []
  const knownAttachmentIds = new Set()

  images.forEach((img) => {
    const entry = resolveImageEntry(noteId, img)
    if (entry?.attachmentId) knownAttachmentIds.add(entry.attachmentId)
  })

  const prefix = `${ATTACHMENT_PREFIX}${noteId}/`
  const attachmentDocs = await dbAllDocs(prefix)
  for (const doc of attachmentDocs || []) {
    const attachmentId = String(doc?._id || doc?.id || '')
    if (!attachmentId || knownAttachmentIds.has(attachmentId)) continue
    const imageId = attachmentId.startsWith(prefix) ? attachmentId.slice(prefix.length) : ''
    if (!imageId) continue
    const mimeType = (await dbGetAttachmentTypeAsync(attachmentId)) || 'application/octet-stream'
    images.push({
      id: imageId,
      attachmentId,
      mimeType,
      sortOrder: images.length,
    })
    knownAttachmentIds.add(attachmentId)
  }

  return images
}

function buildFragmentMarkdown(note, tagName, attachmentWrites, imageEntries) {
  const noteId = String(note.id)
  const images = imageEntries.map((entry) => {
    const ext = mimeToExtension(entry.mimeType)
    const file = joinZipPath(FRAGMENTS_DIR, ATTACHMENTS_DIR, noteId, `${entry.imageId}.${ext}`)
    attachmentWrites.push({
      attachmentId: entry.attachmentId,
      file,
    })
    return {
      id: entry.imageId,
      file,
      mime: entry.mimeType,
      sort: entry.sortOrder,
    }
  })

  const body = note.markdownContent || note.rawContent || ''
  const meta = {
    lb_version: LB_VERSION,
    lb_type: LB_TYPE_FRAGMENT,
    lb_id: noteId,
    lb_tag: tagName || '',
    lb_created: note.createTime || '',
    lb_updated: note.updateTime || '',
    lb_archived: Boolean(note.archivedAt),
    lb_archived_by: note.archivedByStructNoteId || null,
    lb_pin: pinWeightToType(note.pinWeight),
    lb_images: images,
  }

  return serializeFrontmatter(meta, body)
}

export async function exportLanbitouBackup({ includeDeleted = false } = {}) {
  const [notes, structNotes, folders, tags] = await Promise.all([
    loadNotes({ includeDeleted }),
    loadStructNotes(),
    loadFolders(),
    listTagDocs(),
  ])

  const tagNameById = new Map(tags.map((tag) => [String(tag.id), tag.tagName || '']))
  const folderById = new Map(folders.map((folder) => [String(folder.id), folder]))
  const structNoteById = new Map(structNotes.map((note) => [String(note.id), note]))

  const files = {}
  const attachmentWrites = []

  for (const note of notes) {
    const noteId = String(note.id)
    const noteImages = await resolveNoteImages(note)
    const imageEntries = []

    for (const img of noteImages) {
      const entry = resolveImageEntry(noteId, img)
      if (!entry) continue
      if (!entry.mimeType || entry.mimeType === 'application/octet-stream') {
        entry.mimeType =
          (await dbGetAttachmentTypeAsync(entry.attachmentId)) ||
          entry.mimeType ||
          'application/octet-stream'
      }
      imageEntries.push(entry)
    }

    const md = buildFragmentMarkdown(
      note,
      tagNameById.get(String(note.tagId || '')) || '',
      attachmentWrites,
      imageEntries,
    )
    files[joinZipPath(FRAGMENTS_DIR, `${noteId}.md`)] = new TextEncoder().encode(md)
  }

  folders
    .filter((item) => item.type === 'note' && item.noteId)
    .forEach((folderItem) => {
      const note = structNoteById.get(String(folderItem.noteId))
      if (!note) return
      const folderPath = buildFolderPath(folderItem.id, folderById)
      const meta = {
        lb_version: LB_VERSION,
        lb_type: LB_TYPE_SEDIMENT,
        lb_id: note.id,
        lb_folder_item_id: folderItem.id,
        title: note.title || folderItem.name || '无标题',
        lb_tag: tagNameById.get(String(note.tagId || '')) || '',
        lb_source_fragments: [...(note.sourceFragmentIds || [])],
        lb_created: note.createTime || '',
        lb_updated: note.updateTime || '',
      }
      const content = serializeFrontmatter(meta, note.content || '')
      const path = folderPath
        ? joinZipPath(SEDIMENT_DIR, folderPath, `${note.id}.md`)
        : joinZipPath(SEDIMENT_DIR, `${note.id}.md`)
      files[path] = new TextEncoder().encode(content)
    })

  let attachmentsCount = 0
  for (const item of attachmentWrites) {
    const bytes = normalizeAttachmentBytes(await dbGetAttachmentAsync(item.attachmentId))
    if (!bytes?.length) continue
    files[item.file] = bytes
    attachmentsCount += 1
  }

  const manifest = {
    format: BACKUP_FORMAT,
    version: LB_VERSION,
    exportedAt: new Date().toISOString(),
    folders: folders.map((folder) => ({
      id: folder.id,
      parentId: folder.parentId ?? null,
      name: folder.name || '',
      type: folder.type || 'folder',
      noteId: folder.noteId ?? null,
      sort: folder.sort ?? 0,
      createTime: folder.createTime || '',
      updateTime: folder.updateTime || '',
    })),
    stats: {
      fragments: notes.length,
      sedimentNotes: structNotes.length,
      folders: folders.length,
      attachments: attachmentsCount,
      tags: tags.length,
    },
  }

  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2))
  files['tags.json'] = new TextEncoder().encode(
    JSON.stringify(
      tags.map((tag) => ({ id: tag.id, tagName: tag.tagName || '' })),
      null,
      2,
    ),
  )

  const zipped = zipSync(files, { level: 6 })
  const filename = `lanbitou-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`

  return {
    blob: new Blob([zipped], { type: 'application/zip' }),
    filename,
    stats: manifest.stats,
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function exportAndDownloadLanbitouBackup(options = {}) {
  const result = await exportLanbitouBackup(options)
  downloadBlob(result.blob, result.filename)
  return result
}
