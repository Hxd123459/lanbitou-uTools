import { AI_PROVIDERS, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import { parseTitleResultFromAssistantMessage } from './titleParser'

const TITLE_REQUEST_MAX_TOKENS = 256
const TITLE_RETRY_MAX_TOKENS = 512

function buildTitleRequestBody({ model, system, user, maxTokens, jsonMode }) {
  const body = {
    model,
    temperature: 0.1,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }

  if (jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  return body
}

async function requestOpenAiMessage({
  baseUrl,
  apiKey,
  model,
  system,
  user,
  maxTokens = TITLE_REQUEST_MAX_TOKENS,
  jsonMode = true,
}) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      buildTitleRequestBody({ model, system, user, maxTokens, jsonMode }),
    ),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = payload?.error?.message || `OpenAI 请求失败 (${response.status})`
    throw new Error(msg)
  }

  return payload?.choices?.[0]?.message || null
}

async function requestOpenAi({
  baseUrl,
  apiKey,
  model,
  system,
  user,
  maxTokens = TITLE_REQUEST_MAX_TOKENS,
  jsonMode = false,
}) {
  const message = await requestOpenAiMessage({
    baseUrl,
    apiKey,
    model,
    system,
    user,
    maxTokens,
    jsonMode,
  })
  return message?.content || ''
}

async function requestAnthropicMessage({
  baseUrl,
  apiKey,
  model,
  system,
  user,
  maxTokens = TITLE_REQUEST_MAX_TOKENS,
}) {
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
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = payload?.error?.message || `Anthropic 请求失败 (${response.status})`
    throw new Error(msg)
  }

  const block = payload?.content?.find((item) => item.type === 'text')
  return block?.text ? { content: block.text } : null
}

async function requestAnthropic(args) {
  const message = await requestAnthropicMessage(args)
  return message?.content || ''
}

async function callThirdPartyChatMessage({
  provider,
  apiKey,
  baseUrl,
  model,
  system,
  user,
  maxTokens = TITLE_REQUEST_MAX_TOKENS,
  jsonMode = false,
}) {
  const resolvedModel = model || AI_PROVIDERS[provider]?.defaultModel
  const resolvedBaseUrl = baseUrl || AI_PROVIDERS[provider]?.defaultBaseUrl
  if (!apiKey) throw new Error('请先填写 API Key')
  if (!resolvedBaseUrl) throw new Error('请先填写 Base URL')
  if (!resolvedModel) throw new Error('请先填写模型名称')

  const args = {
    baseUrl: resolvedBaseUrl,
    apiKey,
    model: resolvedModel,
    system,
    user,
    maxTokens,
    jsonMode,
  }

  if (provider === 'openai') {
    return requestOpenAiMessage(args)
  }
  if (provider === 'anthropic') {
    return requestAnthropicMessage(args)
  }
  throw new Error('不支持的服务商')
}

export async function callThirdPartyChat({
  provider,
  apiKey,
  baseUrl,
  model,
  system,
  user,
  maxTokens = TITLE_REQUEST_MAX_TOKENS,
  jsonMode = false,
}) {
  const resolvedModel = model || AI_PROVIDERS[provider]?.defaultModel
  const resolvedBaseUrl = baseUrl || AI_PROVIDERS[provider]?.defaultBaseUrl
  if (!apiKey) throw new Error('请先填写 API Key')
  if (!resolvedBaseUrl) throw new Error('请先填写 Base URL')
  if (!resolvedModel) throw new Error('请先填写模型名称')

  const args = {
    baseUrl: resolvedBaseUrl,
    apiKey,
    model: resolvedModel,
    system,
    user,
    maxTokens,
    jsonMode,
  }

  if (provider === 'openai') {
    return requestOpenAi(args)
  }
  if (provider === 'anthropic') {
    return requestAnthropic(args)
  }
  throw new Error('不支持的服务商')
}

function buildStrictTitlePrompt(systemPrompt) {
  return `${systemPrompt}

最后提醒：不要输出思考过程、不要 reasoning、不要解释。无法判断主题或语义不清时输出 {"title":"意义不明"}，否则输出 {"title":"标签"}。`
}

async function requestTitleMessage(settings, systemPrompt, userContent, attempt) {
  return callThirdPartyChatMessage({
    provider: settings.provider,
    apiKey: settings.apiKey,
    baseUrl: getResolvedBaseUrl(settings),
    model: getResolvedModel(settings),
    system: attempt.strict ? buildStrictTitlePrompt(systemPrompt) : systemPrompt,
    user: userContent,
    maxTokens: attempt.maxTokens,
    jsonMode: attempt.jsonMode,
  })
}

export async function generateTitleViaThirdParty(settings, systemPrompt, userContent) {
  const attempts = [
    { maxTokens: TITLE_REQUEST_MAX_TOKENS, jsonMode: true, strict: false },
    { maxTokens: TITLE_RETRY_MAX_TOKENS, jsonMode: true, strict: true },
    { maxTokens: TITLE_RETRY_MAX_TOKENS, jsonMode: false, strict: true },
  ]

  let lastMessage = null

  for (const attempt of attempts) {
    try {
      const message = await requestTitleMessage(
        settings,
        systemPrompt,
        userContent,
        attempt,
      )
      lastMessage = message
      const { title, resolved } = parseTitleResultFromAssistantMessage(message)
      if (resolved) return title
    } catch (error) {
      console.warn('[烂笔头] AI 标题请求失败，准备重试', error)
    }
  }

  if (lastMessage) {
    console.warn('[烂笔头] AI 标题解析失败', {
      content: String(lastMessage.content ?? '').slice(0, 120),
      reasoning: String(
        lastMessage.reasoning_content ?? lastMessage.reasoning ?? '',
      ).slice(0, 120),
    })
  }

  return null
}

export async function testThirdPartyConnection(settings) {
  const content = await callThirdPartyChat({
    provider: settings.provider,
    apiKey: settings.apiKey,
    baseUrl: getResolvedBaseUrl(settings),
    model: getResolvedModel(settings),
    system: '你是一个连通性测试助手。只回复 OK，不要输出其他内容。',
    user: 'ping',
  })
  if (!String(content || '').trim()) {
    throw new Error('模型未返回内容')
  }
  return true
}
