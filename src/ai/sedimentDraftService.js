import { isUtoolsMode } from '../storage/env'
import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import {
  getSedimentTemplateInstruction,
  getSedimentTemplateTitle,
  LEGACY_BUILTIN_LABELS,
} from '../storage/utools/sedimentTemplates'
import { isUtoolsAiAvailable } from './aiService'
import { resolveWritingStylePromptSection } from './writingStyleService'
import { getFragmentContent } from '../composables/useStructNoteFragments'

export const SEDIMENT_DRAFT_PRESETS = Object.fromEntries(
  Object.entries(LEGACY_BUILTIN_LABELS).map(([id, label]) => [id, { id, label }]),
)

export const FRAGMENT_INTRO_RAW = 'raw'

export function getIntroduceMethodLabel(methodId) {
  const key = String(methodId ?? '').trim()
  if (!key || key === FRAGMENT_INTRO_RAW) return '原文'
  return getSedimentTemplateTitle(key) || SEDIMENT_DRAFT_PRESETS[key]?.label || key
}

const DRAFT_SYSTEM_BASE = `你是烂笔头的笔记整理助手。根据用户提供的碎片笔记，生成可直接编辑的长文初稿。

输出规则（严格遵守）：
1. 第一行必须是 Markdown 一级标题，格式：# 标题（2-15字，概括主题）
2. 第二行起是正文，使用 Markdown 格式（小标题、列表、引用等均可）
3. 禁止输出思考过程、解释、寒暄或 JSON
4. 不要重复罗列原始碎片编号，直接整合成文
5. 若碎片信息不足，基于已有内容尽力整理，不要编造事实`

const FRAGMENT_INSERT_SYSTEM_BASE = `你是烂笔头的笔记整理助手。根据用户提供的碎片笔记，生成可直接插入长文正文的 Markdown 内容块。

输出规则（严格遵守）：
1. 只输出一段 Markdown 正文，不要输出文档标题（禁止单独的一级 # 标题行）
2. 使用 Markdown 格式（小标题、列表、引用、待办等均可）
3. 禁止输出思考过程、解释、寒暄或 JSON
4. 不要重复罗列原始碎片编号，直接整合成文；不要遗漏任一条碎片中的有效信息
5. 图片由系统单独处理，你只处理文字，不要输出图片语法
6. 若碎片信息不足，基于已有内容尽力整理，不要编造事实`

const APPEND_DRAFT_SYSTEM_BASE = `你是烂笔头的笔记整理助手。用户已有一篇长文，请将提供的新碎片整理成可追加到文末的内容块。

输出规则（严格遵守）：
1. 只输出要追加的 Markdown 正文，不要输出文档标题（禁止单独的一级 # 标题行）
2. 使用 Markdown 格式（小标题、列表、引用、待办等均可），风格与已有正文尽量一致
3. 禁止重复输出已有正文内容
4. 禁止输出思考过程、解释、寒暄或 JSON
5. 不要重复罗列原始碎片编号，直接整合成文
6. 若碎片信息不足，基于已有内容尽力整理，不要编造事实`

function buildSystemPrompt(preset, customPrompt, styleSection = '', mode = 'generate') {
  const instruction = getSedimentTemplateInstruction(preset)
  const base = mode === 'fragment'
    ? FRAGMENT_INSERT_SYSTEM_BASE
    : mode === 'append'
      ? APPEND_DRAFT_SYSTEM_BASE
      : DRAFT_SYSTEM_BASE
  let prompt = `${base}\n\n整理方式：${instruction}`
  const custom = String(customPrompt ?? '').trim()
  if (custom) {
    prompt += `\n\n用户补充要求：${custom}`
  }
  const style = String(styleSection ?? '').trim()
  if (style) {
    prompt += `\n\n${style}`
  }
  return prompt
}

function fragmentLabel(note, index) {
  const tag = note?.title || note?.fineTitle || ''
  if (tag) return tag
  const text = getFragmentContent(note).replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 16) + (text.length > 16 ? '…' : '') : `碎片${index + 1}`
}

export function buildFragmentsUserMessage(fragments) {
  const list = Array.isArray(fragments) ? fragments : []
  if (!list.length) return '（无碎片内容）'

  return list
    .map((note, i) => {
      const label = fragmentLabel(note, i)
      const body = getFragmentContent(note).trim() || '（空）'
      return `【碎片${i + 1}: ${label}】\n${body}`
    })
    .join('\n\n')
}

export function buildAppendUserMessage(existingContent, fragments) {
  const body = String(existingContent ?? '').trim() || '（空）'
  const fragmentsMessage = buildFragmentsUserMessage(fragments)
  return `【已有正文】\n${body}\n\n【待整理的新碎片】\n${fragmentsMessage}`
}

export function parseAppendContent(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return ''

  const lines = text.split('\n')
  let bodyStart = 0

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^#\s+/.test(line)) {
      bodyStart = i + 1
      break
    }
    bodyStart = i + 1
    break
  }

  return lines.slice(bodyStart).join('\n').trim() || text
}

export function parseDraftTitleAndContent(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { title: '', content: '' }

  const lines = text.split('\n')
  let title = ''
  let bodyStart = 0

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^#\s+/.test(line)) {
      title = line.replace(/^#+\s*/, '').trim().slice(0, 80)
      bodyStart = i + 1
      break
    }
    title = line.replace(/^#+\s*/, '').trim().slice(0, 80)
    bodyStart = i + 1
    break
  }

  const content = lines.slice(bodyStart).join('\n').trim()
  return { title, content: content || text }
}

export function isSedimentDraftAiAvailable() {
  if (!isUtoolsMode()) return false
  const settings = loadAiSettings()
  if (settings.provider === 'utools') return isUtoolsAiAvailable()
  return Boolean(String(settings.apiKey ?? '').trim() && String(settings.baseUrl ?? '').trim())
}

function simulateStream(text, onDelta, onDone) {
  const full = String(text ?? '')
  if (!full) {
    onDone?.()
    return () => {}
  }

  let index = 0
  let cancelled = false
  const chunkSize = 8

  const tick = () => {
    if (cancelled || index >= full.length) {
      if (!cancelled) onDone?.()
      return
    }
    const next = full.slice(index, index + chunkSize)
    index += chunkSize
    onDelta?.(next)
    window.setTimeout(tick, 16)
  }

  window.setTimeout(tick, 0)
  return () => {
    cancelled = true
  }
}

async function requestUtoolsDraft(systemPrompt, userContent, model) {
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
  const content = String(result?.content || '').trim()
  if (!content) throw new Error('AI 未返回内容')
  return content
}

async function streamOpenAiDraft({ baseUrl, apiKey, model, systemPrompt, userContent, onDelta, onDone, onError }) {
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 4096,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.error?.message || `OpenAI 请求失败 (${response.status})`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取流式响应')

    const decoder = new TextDecoder()
    let buffer = ''

    while (!cancelled) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed?.choices?.[0]?.delta?.content
          if (delta) onDelta?.(delta)
        } catch {
          // ignore partial JSON
        }
      }
    }

    if (!cancelled) onDone?.()
  } catch (error) {
    if (!cancelled) {
      onError?.(error instanceof Error ? error : new Error('AI 整理失败'))
    }
  }

  return cancel
}

async function streamAnthropicDraft({ baseUrl, apiKey, model, systemPrompt, userContent, onDelta, onDone, onError }) {
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }

  try {
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
        max_tokens: 4096,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.error?.message || `Anthropic 请求失败 (${response.status})`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取流式响应')

    const decoder = new TextDecoder()
    let buffer = ''

    while (!cancelled) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            onDelta?.(parsed.delta.text || '')
          }
        } catch {
          // ignore
        }
      }
    }

    if (!cancelled) onDone?.()
  } catch (error) {
    if (!cancelled) {
      onError?.(error instanceof Error ? error : new Error('AI 整理失败'))
    }
  }

  return cancel
}

/**
 * 生成沉淀初稿（流式）
 * @returns {() => void} 取消函数
 */
export function generateSedimentDraft({
  fragments,
  preset = 'compose',
  customPrompt,
  mode = 'generate',
  existingContent = '',
  onDelta,
  onTitle,
  onDone,
  onError,
}) {
  const draftMode = mode === 'append' ? 'append' : mode === 'fragment' ? 'fragment' : 'generate'
  const userContent = draftMode === 'append'
    ? buildAppendUserMessage(existingContent, fragments)
    : buildFragmentsUserMessage(fragments)
  let accumulated = ''
  let cancelled = false
  let innerCancel = () => {}

  const finish = () => {
    if (cancelled) return
    if (draftMode === 'append' || draftMode === 'fragment') {
      const content = parseAppendContent(accumulated)
      onDone?.({ title: '', content })
      return
    }
    const { title, content } = parseDraftTitleAndContent(accumulated)
    if (title) onTitle?.(title)
    onDone?.({ title, content: content || accumulated })
  }

  const handleDelta = (chunk) => {
    if (cancelled) return
    accumulated += chunk
    onDelta?.(chunk, accumulated)
  }

  if (!isUtoolsMode()) {
    onError?.(new Error('AI 整理仅在 uTools 模式下可用'))
    return () => {}
  }

  const settings = loadAiSettings()
  const excludeIds = (Array.isArray(fragments) ? fragments : [])
    .map((note) => note?.id)
    .filter(Boolean)

  ;(async () => {
    try {
      const styleSection = await resolveWritingStylePromptSection({ excludeIds })
      const systemPrompt = buildSystemPrompt(preset, customPrompt, styleSection, draftMode)

      if (settings.provider === 'utools') {
        const content = await requestUtoolsDraft(systemPrompt, userContent, settings.model)
        if (cancelled) return
        innerCancel = simulateStream(content, handleDelta, finish)
        return
      }

      if (settings.provider === 'openai') {
        const baseUrl = getResolvedBaseUrl(settings)
        const model = getResolvedModel(settings)
        if (!settings.apiKey) throw new Error('请先在设置中填写 API Key')

        innerCancel = await streamOpenAiDraft({
          baseUrl,
          apiKey: settings.apiKey,
          model,
          systemPrompt,
          userContent,
          onDelta: handleDelta,
          onDone: finish,
          onError: (err) => {
            if (!cancelled) onError?.(err)
          },
        })
        return
      }

      if (settings.provider === 'anthropic') {
        const baseUrl = getResolvedBaseUrl(settings)
        const model = getResolvedModel(settings)
        if (!settings.apiKey) throw new Error('请先在设置中填写 API Key')

        innerCancel = await streamAnthropicDraft({
          baseUrl,
          apiKey: settings.apiKey,
          model,
          systemPrompt,
          userContent,
          onDelta: handleDelta,
          onDone: finish,
          onError: (err) => {
            if (!cancelled) onError?.(err)
          },
        })
        return
      }

      throw new Error('不支持的 AI 服务商')
    } catch (error) {
      if (!cancelled) {
        onError?.(error instanceof Error ? error : new Error('AI 整理失败'))
      }
    }
  })()

  return () => {
    cancelled = true
    innerCancel?.()
  }
}
