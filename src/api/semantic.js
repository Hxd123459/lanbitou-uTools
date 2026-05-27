import { post } from './http'

export const DEFAULT_MIN_SIMILARITY = '0.75'

/**
 * 语义检索碎片笔记
 * @param {{ query: string, minSimilarity?: string }} params
 */
export async function semanticTextSearch({ query, minSimilarity = DEFAULT_MIN_SIMILARITY }) {
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
