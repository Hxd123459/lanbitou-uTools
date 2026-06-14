import { globalSearch } from '../storage/utools/globalSearchRepository'
import { allTags, getNotesByIds } from '../storage/utools/noteRepository'
import { getStructNote } from '../storage/utools/structRepository'
import { findTagByName } from '../storage/utools/tagRepository'

const MAX_FRAGMENT_CHARS = 8000
const MAX_SEDIMENT_CHARS = 12000

export const NOTE_SEARCH_TOOL_NAMES = ['search_fragments', 'get_fragment', 'list_tags']

export const NOTE_SEARCH_TOOL_DEFINITIONS = [
  {
    name: 'search_fragments',
    description:
      '按关键词搜索用户的碎片笔记或沉淀长文。用户询问「我记过什么」「找一下关于 XX 的笔记」时优先调用。',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'string',
          description: '搜索关键词，多个词用空格分隔',
        },
        tagName: {
          type: 'string',
          description: '可选，按标签名筛选',
        },
        type: {
          type: 'string',
          enum: ['fragment', 'sediment', 'all'],
          description: '笔记类型：fragment 碎片、sediment 沉淀长文、all 全部（默认）',
        },
        limit: {
          type: 'number',
          description: '返回条数，默认 10，最大 20',
        },
      },
      required: ['keywords'],
    },
  },
  {
    name: 'get_fragment',
    description:
      '获取单条碎片或沉淀长文的完整内容。在 search_fragments 找到目标后，用此工具读取详情再回答。',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '笔记 ID，来自 search_fragments 返回的 id',
        },
        type: {
          type: 'string',
          enum: ['fragment', 'sediment'],
          description: '笔记类型，不确定时可省略（会自动尝试匹配）',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tags',
    description: '列出用户所有标签及笔记数量，便于了解笔记分类后再搜索。',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
]

function normalizeKeywords(keywords) {
  const list = Array.isArray(keywords) ? keywords : [keywords]
  const expanded = list.flatMap((item) => {
    const text = String(item ?? '').trim()
    if (!text) return []
    return text.split(/\s+/).filter(Boolean)
  })
  return [...new Set(expanded)]
}

function truncateContent(content, maxChars) {
  const text = String(content ?? '')
  if (text.length <= maxChars) {
    return { content: text, truncated: false }
  }
  return {
    content: `${text.slice(0, maxChars)}…（内容已截断）`,
    truncated: true,
  }
}

async function getFragmentDetail(id) {
  const notes = await getNotesByIds([id])
  if (!notes.length) return null
  const note = notes[0]
  const raw = note.markdownContent || note.rawContent || note.summary || ''
  const { content, truncated } = truncateContent(raw, MAX_FRAGMENT_CHARS)
  return {
    id: note.id,
    type: 'fragment',
    title: note.title || '',
    createTime: note.createTime || '',
    content,
    truncated,
  }
}

async function getSedimentDetail(id) {
  const note = await getStructNote(id)
  if (!note) return null
  const { content, truncated } = truncateContent(note.content || '', MAX_SEDIMENT_CHARS)
  return {
    id: note.id,
    type: 'sediment',
    title: note.title || '',
    createTime: note.createTime || '',
    content,
    truncated,
  }
}

export async function handleSearchFragments(params = {}) {
  const keywordList = normalizeKeywords(params.keywords)
  if (!keywordList.length) {
    return { items: [], total: 0, message: '请提供搜索关键词' }
  }

  let tagId = null
  const tagName = String(params.tagName ?? '').trim()
  if (tagName) {
    const tag = await findTagByName(tagName)
    tagId = tag?.id ?? null
  }

  const noteType = params.type === 'fragment' || params.type === 'sediment'
    ? params.type
    : 'all'
  const scopes =
    noteType === 'fragment'
      ? ['fragment']
      : noteType === 'sediment'
        ? ['sediment']
        : ['fragment', 'sediment']

  const safeLimit = Math.min(Math.max(Math.floor(params.limit) || 10, 1), 20)
  const result = await globalSearch({
    keywords: keywordList,
    tagId,
    scopes,
    page: 1,
    pageSize: safeLimit,
  })

  return {
    total: result.total,
    items: (result.records || []).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title || '',
      tagName: item.tagName || '',
      createTime: item.createTime || '',
      snippets: item.snippets || [],
    })),
  }
}

export async function handleGetFragment(params = {}) {
  const id = String(params.id ?? '').trim()
  if (!id) return { error: '缺少 id 参数' }

  const explicitType = params.type === 'fragment' || params.type === 'sediment'
    ? params.type
    : null

  if (explicitType === 'fragment') {
    const detail = await getFragmentDetail(id)
    return detail || { error: '未找到该碎片笔记', id }
  }
  if (explicitType === 'sediment') {
    const detail = await getSedimentDetail(id)
    return detail || { error: '未找到该沉淀长文', id }
  }

  const fragment = await getFragmentDetail(id)
  if (fragment) return fragment
  const sediment = await getSedimentDetail(id)
  if (sediment) return sediment
  return { error: '未找到该笔记', id }
}

export async function handleListTags() {
  const tags = await allTags()
  return {
    items: (tags || []).map((tag) => ({
      tagId: tag.tagId,
      tagName: tag.tagName,
      noteCount: Number(tag.noteCount) || 0,
    })),
  }
}

export async function executeNoteSearchTool(name, params = {}) {
  switch (name) {
    case 'search_fragments':
      return handleSearchFragments(params)
    case 'get_fragment':
      return handleGetFragment(params)
    case 'list_tags':
      return handleListTags()
    default:
      throw new Error(`未知工具: ${name}`)
  }
}

export function toOpenAiTools(definitions = NOTE_SEARCH_TOOL_DEFINITIONS) {
  return definitions.map((item) => ({
    type: 'function',
    function: {
      name: item.name,
      description: item.description,
      parameters: item.parameters,
    },
  }))
}

export function toAnthropicTools(definitions = NOTE_SEARCH_TOOL_DEFINITIONS) {
  return definitions.map((item) => ({
    name: item.name,
    description: item.description,
    input_schema: item.parameters,
  }))
}

export function toUtoolsTools(definitions = NOTE_SEARCH_TOOL_DEFINITIONS) {
  return toOpenAiTools(definitions)
}
