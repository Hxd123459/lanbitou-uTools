import { isUtoolsMode } from '../storage/env'
import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import { isSedimentDraftAiAvailable } from './sedimentDraftService'
import { buildUserContent } from './todoCopyUserContent'
import { fallbackGenerate } from './todoCopyFallback'
import { TEMPLATES } from './todoCopyTemplates'

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

export { TEMPLATES } from './todoCopyTemplates'
export function listCopyTemplates() {
  return Object.entries(TEMPLATES).map(([id, conf]) => ({ id, label: conf.label }))
}

/**
 * @param {'daily'|'release'|'retro'} template
 */
export async function generateTodoCopy({ template = 'daily', project, todos = [], runsById = {} } = {}) {
  const key = TEMPLATES[template] ? template : 'daily'
  const conf = TEMPLATES[key]
  const list = Array.isArray(todos) ? todos : []
  if (!list.length) throw new Error('请先选择待办')

  const fallback = fallbackGenerate(key, project, list)
  const userContent = buildUserContent(project, list, runsById)

  if (!isUtoolsMode() || !isSedimentDraftAiAvailable()) {
    return { text: fallback, source: 'fallback', template: key, label: conf.label }
  }

  try {
    const settings = loadAiSettings()
    let raw = ''
    if (settings.provider === 'utools') {
      raw = await requestUtools(conf.system, userContent, settings.model)
    } else if (settings.provider === 'openai') {
      if (!settings.apiKey) throw new Error('missing key')
      raw = await requestOpenAi({
        baseUrl: getResolvedBaseUrl(settings),
        apiKey: settings.apiKey,
        model: getResolvedModel(settings),
        systemPrompt: conf.system,
        userContent,
      })
    } else if (settings.provider === 'anthropic') {
      if (!settings.apiKey) throw new Error('missing key')
      raw = await requestAnthropic({
        baseUrl: getResolvedBaseUrl(settings),
        apiKey: settings.apiKey,
        model: getResolvedModel(settings),
        systemPrompt: conf.system,
        userContent,
      })
    }
    const cleaned = String(raw || '').trim()
    if (!cleaned || cleaned.length < 12) {
      return { text: fallback, source: 'fallback', template: key, label: conf.label }
    }
    return { text: cleaned, source: 'ai', template: key, label: conf.label }
  } catch {
    return { text: fallback, source: 'fallback', template: key, label: conf.label }
  }
}
