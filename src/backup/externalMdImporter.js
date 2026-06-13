import { NOTE_PREFIX } from '../storage/utools/constants'
import { dbPut } from '../storage/utools/dbClient'
import { pinTypeToWeight } from '../storage/utools/pin'
import { ensureTag } from '../storage/utools/tagRepository'
import { createId, formatDateTime } from '../storage/utools/utils'
import { isPlatformMarkdown, parseFrontmatter } from './format'

function extractTitle(body, filename, meta = {}) {
  const fromMeta = String(meta.title || '').trim()
  if (fromMeta) return fromMeta.slice(0, 80)
  const heading = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('#'))
  if (heading) return heading.replace(/^#+\s*/, '').slice(0, 80)
  return String(filename || '未命名').replace(/\.md$/i, '').slice(0, 80) || '未命名'
}

async function importExternalMarkdownFile(file, summary) {
  const text = await file.text()
  const { meta, body } = parseFrontmatter(text)
  if (isPlatformMarkdown(meta)) {
    summary.skipped += 1
    return
  }

  const tagName = String(meta.tag || meta.lb_tag || '').trim()
  let tagId = null
  if (tagName) {
    const tag = await ensureTag(tagName)
    tagId = tag?.id ?? null
  }

  const noteId = createId()
  const now = formatDateTime()
  const title = extractTitle(body, file.name, meta)

  await dbPut({
    _id: `${NOTE_PREFIX}${noteId}`,
    id: noteId,
    title,
    fineTitle: '',
    summary: '',
    rawContent: body,
    markdownContent: body,
    tagId,
    pinWeight: pinTypeToWeight('DEFAULT'),
    images: [],
    createTime: now,
    updateTime: now,
    deletedAt: null,
    archivedAt: null,
    archivedByStructNoteId: null,
  })

  summary.added += 1
}

export async function importExternalMarkdownFiles(files = []) {
  const list = Array.from(files).filter((file) => /\.md$/i.test(file?.name || ''))
  const summary = {
    added: 0,
    skipped: 0,
    errors: [],
  }

  for (const file of list) {
    try {
      await importExternalMarkdownFile(file, summary)
    } catch (error) {
      summary.errors.push({
        path: file.name,
        message: error?.message || '导入失败',
      })
    }
  }

  return summary
}
