import { isUtoolsMode } from '../storage/env'
import * as utoolsNote from '../storage/utools/noteRepository'
import { post } from './http'

export const DEFAULT_MIN_SIMILARITY = '0.75'

export async function semanticTextSearch({ query, minSimilarity = DEFAULT_MIN_SIMILARITY }) {
  if (isUtoolsMode()) {
    const list = await utoolsNote.localSemanticSearch(query)
    const threshold = Number(minSimilarity)
    const filtered = Number.isFinite(threshold)
      ? list.filter((item) => item.similarity == null || item.similarity >= threshold)
      : list
    return filtered.map(mapSemanticNote)
  }

  const data = await post('/api/semantic/text', {
    query: query.trim(),
    minSimilarity,
  })
  const list = Array.isArray(data) ? data : []
  return list.map(mapSemanticNote)
}

export function mapSemanticNote(item) {
  return {
    id: item.id,
    title: item.title || '',
    summary: item.summary || '',
    markdownContent: item.markdownContent || '',
    createTime: item.createTime,
    similarity: item.similarity,
    blocks: item.blocks ?? null,
  }
}
