import { isUtoolsMode } from '../storage/env'
import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import {
  getSedimentTemplateById,
  listTodoTemplates,
} from '../storage/utools/sedimentTemplates'
import { isSedimentDraftAiAvailable } from './sedimentDraftService'
import { buildUserContent } from './todoCopyUserContent'
import { fallbackGenerate } from './todoCopyFallback'

const MAX_TOKENS = 2048

async function requestUtools(systemPrompt, userContent, model) {
  if (typeof window === 'undefined' || typeof window.utools?.ai !== 'function') {
    throw new Error('uTools AI 不可用')
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

async function requestOpenAi({ baseUrl, apiKey, model, systemPrompt, userContent }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: MAX_TOKENS,
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

async function requestAnthropic({ baseUrl, apiKey, model, systemPrompt, userContent }) {
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
      max_tokens: MAX_TOKENS,
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

function resolveTodoTemplate(templateId) {
  const key = String(templateId || '').trim()
  const fromStore = key ? getSedimentTemplateById(key) : null
  if (fromStore?.kind === 'todo') return fromStore
  const list = listTodoTemplates()
  return list.find((item) => item.id === key) || list[0] || null
}

export function listCopyTemplates() {
  return listTodoTemplates().map((item) => ({ id: item.id, label: item.title }))
}

/**
 * @param {string} template 待办模板 id
 */
export async function generateTodoCopy({ template, project, todos = [] } = {}) {
  const conf = resolveTodoTemplate(template)
  if (!conf) throw new Error('没有可用的待办模板')
  const list = Array.isArray(todos) ? todos : []
  if (!list.length) throw new Error('请先选择待办')

  const fallback = fallbackGenerate(conf.id, project, list, conf.title)
  const userContent = buildUserContent(project, list)
  const systemPrompt = conf.instruction

  if (!isUtoolsMode() || !isSedimentDraftAiAvailable()) {
    return { text: fallback, source: 'fallback', template: conf.id, label: conf.title }
  }

  try {
    const settings = loadAiSettings()
    let raw = ''
    if (settings.provider === 'utools') {
      raw = await requestUtools(systemPrompt, userContent, settings.model)
    } else if (settings.provider === 'openai') {
      if (!settings.apiKey) throw new Error('missing key')
      raw = await requestOpenAi({
        baseUrl: getResolvedBaseUrl(settings),
        apiKey: settings.apiKey,
        model: getResolvedModel(settings),
        systemPrompt,
        userContent,
      })
    } else if (settings.provider === 'anthropic') {
      if (!settings.apiKey) throw new Error('missing key')
      raw = await requestAnthropic({
        baseUrl: getResolvedBaseUrl(settings),
        apiKey: settings.apiKey,
        model: getResolvedModel(settings),
        systemPrompt,
        userContent,
      })
    }
    const cleaned = String(raw || '').trim()
    if (!cleaned || cleaned.length < 12) {
      return { text: fallback, source: 'fallback', template: conf.id, label: conf.title }
    }
    return { text: cleaned, source: 'ai', template: conf.id, label: conf.title }
  } catch {
    return { text: fallback, source: 'fallback', template: conf.id, label: conf.title }
  }
}
