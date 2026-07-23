import { isUtoolsMode } from '../storage/env'
import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import { buildTodoSourceHash, normalizeTodoTitle } from '../storage/utools/todoRepository'
import { isUtoolsAiAvailable } from './aiService'
import { isSedimentDraftAiAvailable } from './sedimentDraftService'

const CONTENT_LIMIT = 800
const EXTRACT_MAX_TOKENS = 4096

const SYSTEM_PROMPT = `你是烂笔头的待办提取助手。根据用户提供的碎片笔记，提取可执行的行动项。

输出规则（严格遵守）：
1. 只输出一个 JSON 数组，不要 Markdown 代码围栏，不要解释或寒暄
2. 数组元素格式：{"title":"待办短句","sourceNoteId":"碎片id","excerpt":"原文短摘录"}
3. title 必须是可执行行动项（动词开头更佳），不超过 40 字
4. sourceNoteId 必须来自输入中的碎片 id，禁止编造
5. excerpt 从对应碎片原文截取，不超过 60 字
6. 同一碎片可提取多条；没有行动项的碎片不要输出
7. 不要把纯记录、感想、无行动信息写成待办`

function truncateText(text, limit = CONTENT_LIMIT) {
  const raw = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (raw.length <= limit) return raw
  return `${raw.slice(0, limit)}…`
}

function buildUserMessage(notes) {
  const blocks = (Array.isArray(notes) ? notes : []).map((note, index) => {
    const content = truncateText(note.markdownContent || note.rawContent || '')
    return [
      `### 碎片 ${index + 1}`,
      `id: ${note.id}`,
      `标题: ${note.title || '无标题'}`,
      `内容: ${content || '（空）'}`,
    ].join('\n')
  })
  return `请从以下碎片中提取待办，输出 JSON 数组：\n\n${blocks.join('\n\n')}`
}

function extractJsonArray(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return []

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : text

  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeCandidates(rawItems, notes, existingHashes) {
  const noteMap = new Map((Array.isArray(notes) ? notes : []).map((n) => [String(n.id), n]))
  const hashSet = existingHashes instanceof Set ? existingHashes : new Set(existingHashes || [])
  const seen = new Set()
  const result = []

  for (const item of rawItems) {
    const sourceNoteId = String(item?.sourceNoteId ?? item?.noteId ?? '').trim()
    const title = normalizeTodoTitle(item?.title)
    if (!sourceNoteId || !title || !noteMap.has(sourceNoteId)) continue

    const sourceHash = buildTodoSourceHash(sourceNoteId, title)
    if (seen.has(sourceHash)) continue
    seen.add(sourceHash)

    const note = noteMap.get(sourceNoteId)
    const excerpt = truncateText(
      item?.excerpt || note.markdownContent || note.rawContent || note.title || '',
      60,
    )

    result.push({
      title,
      sourceNoteId,
      sourceExcerpt: excerpt,
      sourceHash,
      exists: hashSet.has(sourceHash),
      selected: !hashSet.has(sourceHash),
      noteTitle: note.title || '',
      sourceTagId: note.tagId ? String(note.tagId) : null,
    })
  }

  return result
}

async function requestUtoolsJson(systemPrompt, userContent, model) {
  if (!isUtoolsAiAvailable()) {
    throw new Error('当前环境不支持 uTools AI')
  }
  const option = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  }
  if (model) option.model = model
  const result = await window.utools.ai(option)
  return String(result?.content || '').trim()
}

async function requestOpenAiJson({ baseUrl, apiKey, model, systemPrompt, userContent }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: EXTRACT_MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI 请求失败 (${response.status})`)
  }
  return String(payload?.choices?.[0]?.message?.content || '').trim()
}

async function requestAnthropicJson({ baseUrl, apiKey, model, systemPrompt, userContent }) {
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: EXTRACT_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Anthropic 请求失败 (${response.status})`)
  }
  const block = (payload?.content || []).find((item) => item.type === 'text')
  return String(block?.text || '').trim()
}

export function isTodoExtractAiAvailable() {
  return isSedimentDraftAiAvailable()
}

/**
 * 从碎片提取待办候选（需预览确认后再写入）
 * @returns {Promise<Array>}
 */
export async function extractTodosFromNotes({ notes, existingHashes } = {}) {
  const list = (Array.isArray(notes) ? notes : []).filter((n) => n?.id)
  if (!list.length) return []

  if (!isUtoolsMode()) {
    throw new Error('待办提取仅在 uTools 模式下可用')
  }
  if (!isTodoExtractAiAvailable()) {
    throw new Error('请先在设置中配置 AI')
  }

  const settings = loadAiSettings()
  const userContent = buildUserMessage(list)
  let raw = ''

  if (settings.provider === 'utools') {
    raw = await requestUtoolsJson(SYSTEM_PROMPT, userContent, settings.model)
  } else if (settings.provider === 'openai') {
    if (!settings.apiKey) throw new Error('请先在设置中填写 API Key')
    raw = await requestOpenAiJson({
      baseUrl: getResolvedBaseUrl(settings),
      apiKey: settings.apiKey,
      model: getResolvedModel(settings),
      systemPrompt: SYSTEM_PROMPT,
      userContent,
    })
  } else if (settings.provider === 'anthropic') {
    if (!settings.apiKey) throw new Error('请先在设置中填写 API Key')
    raw = await requestAnthropicJson({
      baseUrl: getResolvedBaseUrl(settings),
      apiKey: settings.apiKey,
      model: getResolvedModel(settings),
      systemPrompt: SYSTEM_PROMPT,
      userContent,
    })
  } else {
    throw new Error('不支持的 AI 服务商')
  }

  return normalizeCandidates(extractJsonArray(raw), list, existingHashes)
}
