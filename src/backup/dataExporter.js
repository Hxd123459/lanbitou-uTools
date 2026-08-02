import { zipSync } from 'fflate'
import { buildAttachmentId } from '../storage/utools/attachment'
import { isImageMimeType } from '../constants/uploadLimits'
import { extractLbAttRefsFromMarkdown } from '../utils/attachmentMarkdown'
import {
  ATTACHMENT_PREFIX,
  NOTE_PREFIX,
  PROFILE_PREFIX,
  PROJECT_PREFIX,
  STRUCT_FOLDER_PREFIX,
  STRUCT_NOTE_PREFIX,
  TODO_PREFIX,
  TODO_RUN_PREFIX,
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
  PROFILE_BACKUP_FILE,
  SEDIMENT_DIR,
  TODO_RUNS_BACKUP_FILE,
  joinZipPath,
  mimeToExtension,
  normalizeBackupSortOrder,
  mapTodoRunForBackup,
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

async function loadProjects({ includeDeleted = false } = {}) {
  const docs = await dbAllDocs(PROJECT_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && (includeDeleted || !doc.deletedAt))
}

async function loadTodos({ includeDeleted = false } = {}) {
  const docs = await dbAllDocs(TODO_PREFIX)
  return (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && (includeDeleted || !doc.deletedAt))
}

async function loadTodoRuns() {
  const docs = await dbAllDocs(TODO_RUN_PREFIX)
  return (docs || []).map(stripDoc).filter((doc) => doc?.id)
}

async function loadProfiles() {
  const docs = await dbAllDocs(PROFILE_PREFIX)
  const profiles = []
  for (const rawDoc of docs || []) {
    const rawId = String(rawDoc?._id || '')
    if (!rawId.startsWith(PROFILE_PREFIX) || rawId.endsWith('/checkpoint')) continue
    const fullDoc = stripDoc(await dbGet(rawId))
    if (!fullDoc) continue
    profiles.push({
      type: rawId.slice(PROFILE_PREFIX.length),
      ...fullDoc,
    })
  }
  return profiles
}

function normalizeAttachmentBytes(bytes) {
  if (!bytes) return null
  if (bytes instanceof Uint8Array) return bytes
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
  if (Array.isArray(bytes)) return new Uint8Array(bytes)
  if (typeof bytes.length === 'number') return new Uint8Array(bytes)
  return null
}

function resolveAttachmentEntry(noteId, img, mimeType = '') {
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

async function resolveNoteAttachments(note) {
  const noteId = String(note.id)
  const metaById = new Map(
    (Array.isArray(note.images) ? note.images : []).map((item) => [String(item?.id ?? ''), item]),
  )
  const entries = []

  for (const img of Array.isArray(note.images) ? note.images : []) {
    const entry = resolveAttachmentEntry(noteId, img)
    if (!entry) continue
    if (!entry.mimeType || entry.mimeType === 'application/octet-stream') {
      entry.mimeType =
        (await dbGetAttachmentTypeAsync(entry.attachmentId)) ||
        entry.mimeType ||
        'application/octet-stream'
    }
    const meta = metaById.get(entry.imageId)
    entry.fileName = meta?.fileName || meta?.name || ''
    entry.sortOrder = meta?.sortOrder ?? entry.sortOrder ?? 0
    entries.push(entry)
  }

  const prefix = `${ATTACHMENT_PREFIX}${noteId}/`
  const knownAttachmentIds = new Set(entries.map((entry) => entry.attachmentId))
  const attachmentDocs = await dbAllDocs(prefix)
  for (const doc of attachmentDocs || []) {
    const attachmentId = String(doc?._id || doc?.id || '')
    if (!attachmentId || knownAttachmentIds.has(attachmentId)) continue
    const imageId = attachmentId.startsWith(prefix) ? attachmentId.slice(prefix.length) : ''
    if (!imageId) continue
    const mimeType = (await dbGetAttachmentTypeAsync(attachmentId)) || 'application/octet-stream'
    const meta = metaById.get(imageId)
    entries.push({
      imageId,
      attachmentId,
      mimeType,
      fileName: meta?.fileName || meta?.name || '',
      sortOrder: meta?.sortOrder ?? entries.length,
    })
    knownAttachmentIds.add(attachmentId)
  }

  const images = []
  const files = []
  for (const entry of entries.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    if (isImageMimeType(entry.mimeType)) images.push(entry)
    else files.push(entry)
  }
  return { images, files }
}

function buildAttachmentMetaEntries(noteId, entries, attachmentWrites, baseDir) {
  return entries.map((entry, index) => {
    const ext = mimeToExtension(entry.mimeType, entry.fileName)
    const file = joinZipPath(baseDir, ATTACHMENTS_DIR, noteId, `${entry.imageId}.${ext}`)
    attachmentWrites.push({
      attachmentId: entry.attachmentId,
      file,
    })
    return {
      id: entry.imageId,
      file,
      mime: entry.mimeType,
      sort: entry.sortOrder ?? index,
      name: entry.fileName || '',
    }
  })
}

function buildFragmentMarkdown(note, tagName, attachmentWrites, imageEntries, fileEntries) {
  const noteId = String(note.id)
  const images = buildAttachmentMetaEntries(
    noteId,
    imageEntries,
    attachmentWrites,
    FRAGMENTS_DIR,
  )
  const files = buildAttachmentMetaEntries(
    noteId,
    fileEntries,
    attachmentWrites,
    FRAGMENTS_DIR,
  )

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
  }
  if (images.length) meta.lb_images = images
  if (files.length) meta.lb_files = files

  return serializeFrontmatter(meta, body)
}

async function buildSedimentAttachmentEntries(noteId, content, attachmentWrites) {
  const attachmentIds = extractLbAttRefsFromMarkdown(content)
  if (!attachmentIds.length) return { images: [], files: [] }

  const prefix = `${ATTACHMENT_PREFIX}${noteId}/`
  const images = []
  const files = []

  for (const attachmentId of attachmentIds) {
    if (!attachmentId.startsWith(prefix)) continue
    const assetId = attachmentId.slice(prefix.length)
    if (!assetId) continue

    const mimeType =
      (await dbGetAttachmentTypeAsync(attachmentId)) || 'application/octet-stream'
    const ext = mimeToExtension(mimeType)
    const file = joinZipPath(SEDIMENT_DIR, ATTACHMENTS_DIR, noteId, `${assetId}.${ext}`)
    attachmentWrites.push({ attachmentId, file })
    const entry = {
      id: assetId,
      file,
      mime: mimeType,
      name: '',
    }
    if (isImageMimeType(mimeType)) {
      entry.sort = images.length
      images.push(entry)
    } else {
      entry.sort = files.length
      files.push(entry)
    }
  }

  return { images, files }
}

export async function exportLanbitouBackup({ includeDeleted = false } = {}) {
  const [notes, structNotes, folders, tags, projects, todos, todoRuns, profiles] =
    await Promise.all([
      loadNotes({ includeDeleted }),
      loadStructNotes(),
      loadFolders(),
      listTagDocs(),
      loadProjects({ includeDeleted }),
      loadTodos({ includeDeleted }),
      loadTodoRuns(),
      loadProfiles(),
    ])

  const tagNameById = new Map(tags.map((tag) => [String(tag.id), tag.tagName || '']))
  const folderById = new Map(folders.map((folder) => [String(folder.id), folder]))
  const structNoteById = new Map(structNotes.map((note) => [String(note.id), note]))

  const files = {}
  const attachmentWrites = []

  for (const note of notes) {
    const noteId = String(note.id)
    const { images: imageEntries, files: fileEntries } = await resolveNoteAttachments(note)

    const md = buildFragmentMarkdown(
      note,
      tagNameById.get(String(note.tagId || '')) || '',
      attachmentWrites,
      imageEntries,
      fileEntries,
    )
    files[joinZipPath(FRAGMENTS_DIR, `${noteId}.md`)] = new TextEncoder().encode(md)
  }

  const sedimentFolderItems = folders.filter((item) => item.type === 'note' && item.noteId)
  for (const folderItem of sedimentFolderItems) {
    const note = structNoteById.get(String(folderItem.noteId))
    if (!note) continue
    const noteId = String(note.id)
    const folderPath = buildFolderPath(folderItem.id, folderById)
    const { images: sedimentImages, files: sedimentFiles } = await buildSedimentAttachmentEntries(
      noteId,
      note.content || '',
      attachmentWrites,
    )
    const meta = {
      lb_version: LB_VERSION,
      lb_type: LB_TYPE_SEDIMENT,
      lb_id: note.id,
      lb_folder_item_id: folderItem.id,
      title: note.title || folderItem.name || '无标题',
      lb_tag: tagNameById.get(String(note.tagId || '')) || '',
      lb_source_fragments: [...(note.sourceFragmentIds || [])],
      lb_introduced_fragments: [...(note.introducedFragmentIds || [])],
      lb_created: note.createTime || '',
      lb_updated: note.updateTime || '',
    }
    if (sedimentImages.length) meta.lb_images = sedimentImages
    if (sedimentFiles.length) meta.lb_files = sedimentFiles
    const content = serializeFrontmatter(meta, note.content || '')
    const path = folderPath
      ? joinZipPath(SEDIMENT_DIR, folderPath, `${note.id}.md`)
      : joinZipPath(SEDIMENT_DIR, `${note.id}.md`)
    files[path] = new TextEncoder().encode(content)
  }

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
      projects: projects.length,
      todos: todos.length,
      todoRuns: todoRuns.length,
      profiles: profiles.length,
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
  files['projects.json'] = new TextEncoder().encode(
    JSON.stringify(
      projects.map((project) => ({
        id: project.id,
        name: project.name || '',
        tagIds: Array.isArray(project.tagIds) ? project.tagIds : [],
        status: project.status === 'archived' ? 'archived' : 'active',
        startAt: project.startAt || null,
        endAt: project.endAt || null,
        localPath: project.localPath || null,
        archivePath: project.archivePath || null,
        sedimentFolderId: project.sedimentFolderId || null,
        purpose: project.purpose || '',
        successLooksLike: project.successLooksLike || '',
        outOfScope: project.outOfScope || '',
        decisions: Array.isArray(project.decisions) ? project.decisions : [],
        lastSyncedAt: project.lastSyncedAt || null,
        sortOrder: normalizeBackupSortOrder(project.sortOrder, 0),
        createTime: project.createTime || '',
        updateTime: project.updateTime || '',
        deletedAt: project.deletedAt || null,
      })),
      null,
      2,
    ),
  )
  files['todos.json'] = new TextEncoder().encode(
    JSON.stringify(
      todos.map((todo) => ({
        id: todo.id,
        projectId: todo.projectId || '',
        title: todo.title || '',
        done: Boolean(todo.done),
        priority: todo.priority === 'high' ? 'high' : 'normal',
        createdBy: todo.createdBy === 'sync' ? 'sync' : 'manual',
        sourceNoteId: todo.sourceNoteId || null,
        sourceNoteTitle: todo.sourceNoteTitle || '',
        sourceTagId: todo.sourceTagId || null,
        sourceTagName: todo.sourceTagName || '',
        sourceExcerpt: todo.sourceExcerpt || '',
        doneWhen: todo.doneWhen || '',
        sourceHash: todo.sourceHash || null,
        runStatus: todo.runStatus || 'idle',
        lastRunId: todo.lastRunId || null,
        sortOrder: normalizeBackupSortOrder(todo.sortOrder, 0),
        createTime: todo.createTime || '',
        updateTime: todo.updateTime || '',
        deletedAt: todo.deletedAt || null,
      })),
      null,
      2,
    ),
  )
  files[TODO_RUNS_BACKUP_FILE] = new TextEncoder().encode(
    JSON.stringify(todoRuns.map(mapTodoRunForBackup), null, 2),
  )
  files[PROFILE_BACKUP_FILE] = new TextEncoder().encode(
    JSON.stringify(profiles, null, 2),
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
