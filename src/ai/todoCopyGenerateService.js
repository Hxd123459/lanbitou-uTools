import { isUtoolsMode } from '../storage/env'
import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import { isSedimentDraftAiAvailable } from './sedimentDraftService'

const MAX_TOKENS = 2048

const TEMPLATES = {
  daily: {
    label: '日报',
    system: `你是工程师日报助手。根据待办列表写一份简洁中文日报 Markdown。
要求包含：今日完成 / 风险或阻塞（如有）/ 明日计划（可空）。语气客观，适合粘贴到飞书/钉钉。不要寒暄。`,
  },
  release: {
    label: '版本说明',
    system: `你是产品版本说明助手。根据已完成待办写中文 Changelog Markdown。
分类：### 新功能 / ### 体验优化 / ### 修复。面向用户，避免内部实现细节。不要寒暄。`,
  },
  retro: {
    label: '短复盘',
    system: `你是独立开发者复盘助手。根据待办写一段短复盘 Markdown：做得好的 / 踩坑 / 下次改进。不超过 250 字。不要寒暄。`,
  },
}

function fallbackGenerate(template, project, todos) {
  const title = project?.name || '事情'
  const lines = todos.map((t) => `- ${t.title}${t.done ? '' : '（未完成）'}`)
  if (template === 'daily') {
    return [`# 日报 · ${title}`, '', '## 今日完成', '', ...lines, ''].join('\n')
  }
  if (template === 'release') {
    return [`# 版本说明 · ${title}`, '', '### 更新', '', ...lines, ''].join('\n')
  }
  return [`# 复盘 · ${title}`, '', ...lines, ''].join('\n')
}

function buildUserContent(project, todos, runsById = {}) {
  const blocks = todos.map((todo, i) => {
    const run = runsById[String(todo.id)] || null
    return [
      `${i + 1}. ${todo.title}`,
      todo.done ? '状态: 已完成' : '状态: 未完成',
      run?.summary ? `摘要: ${String(run.summary).slice(0, 400)}` : '',
      run?.reviewNote ? `验收备注: ${run.reviewNote}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  })
  return [
    `事情：${project?.name || ''}`,
    project?.purpose ? `初衷：${project.purpose}` : '',
    '',
    '待办：',
    blocks.join('\n\n'),
  ]
    .filter(Boolean)
    .join('\n')
}

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
