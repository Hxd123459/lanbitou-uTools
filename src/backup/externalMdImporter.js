import { insertNote } from '../storage/utools/noteRepository'
import { parseFrontmatter } from './format'

function isMarkdownFile(file) {
  const name = String(file?.name || '')
  if (/\.(md|markdown)$/i.test(name)) return true
  return String(file?.type || '').toLowerCase() === 'text/markdown'
}

async function importExternalMarkdownFile(file) {
  const text = await file.text()
  const { meta, body } = parseFrontmatter(text)
  const content = String(body ?? '').trim() ? body : text
  const tagName = String(meta.tag || '').trim()
  await insertNote(content, [], null, { tagName })
}

export async function importExternalMarkdownFiles(files = [], { onProgress } = {}) {
  const picked = Array.from(files)
  const list = picked.filter(isMarkdownFile)
  const summary = {
    picked: picked.length,
    total: list.length,
    processed: 0,
    added: 0,
    errors: [],
  }

  for (let i = 0; i < list.length; i += 1) {
    const file = list[i]
    try {
      await importExternalMarkdownFile(file)
      summary.added += 1
    } catch (error) {
      summary.errors.push({ path: file.name, message: error?.message || '导入失败' })
    }
    summary.processed = i + 1
    onProgress?.({ current: summary.processed, total: summary.total, fileName: file.name })
    await new Promise((r) => requestAnimationFrame(r))
  }

  return summary
}
