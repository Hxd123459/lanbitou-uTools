import { AI_PROVIDERS, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'

function parseTitleFromContent(content) {
  if (!content) return null

  let text = String(content).trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  text = text.replace(/[\n\r\t]/g, '').trim()

  try {
    const json = JSON.parse(text)
    const title = String(json.title ?? '').trim()
    return title || null
  } catch {
    const plain = text.replace(/^["']|["']$/g, '').trim()
    return plain ? plain.slice(0, 5) : null
  }
}

async function requestOpenAi({ baseUrl, apiKey, model, system, user }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 128,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = payload?.error?.message || `OpenAI 请求失败 (${response.status})`
    throw new Error(msg)
  }

  return payload?.choices?.[0]?.message?.content || ''
}

async function requestAnthropic({ baseUrl, apiKey, model, system, user }) {
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
      max_tokens: 128,
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
  return block?.text || ''
}

export async function callThirdPartyChat({ provider, apiKey, baseUrl, model, system, user }) {
  const resolvedModel = model || AI_PROVIDERS[provider]?.defaultModel
  const resolvedBaseUrl = baseUrl || AI_PROVIDERS[provider]?.defaultBaseUrl
  if (!apiKey) throw new Error('请先填写 API Key')
  if (!resolvedBaseUrl) throw new Error('请先填写 Base URL')
  if (!resolvedModel) throw new Error('请先填写模型名称')

  if (provider === 'openai') {
    return requestOpenAi({ baseUrl: resolvedBaseUrl, apiKey, model: resolvedModel, system, user })
  }
  if (provider === 'anthropic') {
    return requestAnthropic({ baseUrl: resolvedBaseUrl, apiKey, model: resolvedModel, system, user })
  }
  throw new Error('不支持的服务商')
}

export async function generateTitleViaThirdParty(settings, systemPrompt, userContent) {
  const content = await callThirdPartyChat({
    provider: settings.provider,
    apiKey: settings.apiKey,
    baseUrl: getResolvedBaseUrl(settings),
    model: getResolvedModel(settings),
    system: systemPrompt,
    user: userContent,
  })
  return parseTitleFromContent(content)
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
