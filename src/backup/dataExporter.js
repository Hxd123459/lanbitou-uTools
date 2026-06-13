import { zipSync } from 'fflate'
import { buildAttachmentId } from '../storage/utools/attachment'
import {
  NOTE_PREFIX,
  STRUCT_FOLDER_PREFIX,
  STRUCT_NOTE_PREFIX,
} from '../storage/utools/constants'
import { dbAllDocs, dbGetAttachment } from '../storage/utools/dbClient'
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

async function loadNotes({ includeDeleted = false }) {
  const docs = await dbAllDocs(NOTE_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && (includeDeleted || !doc.deletedAt))
}

async function loadStructNotes() {
  const docs = await dbAllDocs(STRUCT_NOTE_PREFIX)
  return (docs || []).map(stripDoc).filter((doc) => doc?.id)
}

async function loadFolders() {
  const docs = await dbAllDocs(STRUCT_FOLDER_PREFIX)
  return (docs || []).map(stripDoc).filter((doc) => doc?.id)
}

function buildFragmentMarkdown(note, tagName, attachmentWrites) {
  const images = (note.images || []).map((img) => {
    const imageId = img.id
    const ext = mimeToExtension(img.mimeType)
    const file = joinZipPath(FRAGMENTS_DIR, ATTACHMENTS_DIR, note.id, `${imageId}.${ext}`)
    attachmentWrites.push({
      attachmentId: img.attachmentId || buildAttachmentId(note.id, imageId),
      file,
    })
    return {
      id: imageId,
      file,
      mime: img.mimeType || 'application/octet-stream',
      sort: img.sortOrder ?? 0,
    }
  })

  const body = note.markdownContent || note.rawContent || ''
  const meta = {
    lb_version: LB_VERSION,
    lb_type: LB_TYPE_FRAGMENT,
    lb_id: note.id,
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

  notes.forEach((note) => {
    const md = buildFragmentMarkdown(
      note,
      tagNameById.get(String(note.tagId || '')) || '',
      attachmentWrites,
    )
    files[joinZipPath(FRAGMENTS_DIR, `${note.id}.md`)] = new TextEncoder().encode(md)
  })

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
  attachmentWrites.forEach((item) => {
    const bytes = dbGetAttachment(item.attachmentId)
    if (!bytes) return
    files[item.file] = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    attachmentsCount += 1
  })

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
