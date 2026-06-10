import { isUtoolsMode } from '../storage/env'
import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import { isUtoolsAiAvailable } from './aiService'
import { streamChatFromBackend } from '../api/chat'

const CHAT_SYSTEM_PROMPT =
  '你是烂笔头个人助理，帮助用户整理思路、回答问题。回答简洁清晰，语气友好。'

function buildMessages(history, userMessage) {
  const messages = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }]
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content })
    }
  }
  messages.push({ role: 'user', content: userMessage })
  return messages
}

async function chatViaUtools(messages, model) {
  if (!isUtoolsAiAvailable()) {
    throw new Error('当前环境不支持 uTools AI')
  }
  const option = { messages }
  if (model) option.model = model
  const result = await window.utools.ai(option)
  const content = String(result?.content || '').trim()
  if (!content) throw new Error('AI 未返回内容')
  return content
}

async function requestOpenAiChat({ baseUrl, apiKey, model, messages }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 2048,
      messages,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = payload?.error?.message || `OpenAI 请求失败 (${response.status})`
    throw new Error(msg)
  }

  const content = payload?.choices?.[0]?.message?.content || ''
  if (!String(content).trim()) throw new Error('AI 未返回内容')
  return content
}

async function requestAnthropicChat({ baseUrl, apiKey, model, messages }) {
  const system = messages.find((m) => m.role === 'system')?.content || CHAT_SYSTEM_PROMPT
  const chatMessages = messages.filter((m) => m.role !== 'system')

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
      max_tokens: 2048,
      system,
      messages: chatMessages,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = payload?.error?.message || `Anthropic 请求失败 (${response.status})`
    throw new Error(msg)
  }

  const block = payload?.content?.find((item) => item.type === 'text')
  const content = block?.text || ''
  if (!String(content).trim()) throw new Error('AI 未返回内容')
  return content
}

async function chatViaThirdParty(settings, messages) {
  const { provider, apiKey } = settings
  const baseUrl = getResolvedBaseUrl(settings)
  const model = getResolvedModel(settings)
  if (!apiKey) throw new Error('请先在设置中填写 API Key')

  if (provider === 'openai') {
    return requestOpenAiChat({ baseUrl, apiKey, model, messages })
  }
  if (provider === 'anthropic') {
    return requestAnthropicChat({ baseUrl, apiKey, model, messages })
  }
  throw new Error('不支持的 AI 服务商')
}

/**
 * 发送一条用户消息并获取 AI 回复
 * @returns {() => void} 流式模式下返回取消函数，非流式返回空函数
 */
export function sendChatMessage({ history, userMessage, onDelta, onDone, onError }) {
  const text = String(userMessage ?? '').trim()
  if (!text) return () => {}

  if (!isUtoolsMode()) {
    let cancel = () => {}
    cancel = streamChatFromBackend(text, {
      onDelta,
      onDone,
      onError,
    })
    return cancel
  }

  const settings = loadAiSettings()
  const messages = buildMessages(history, text)

  ;(async () => {
    try {
      let content
      if (settings.provider === 'utools') {
        content = await chatViaUtools(messages, settings.model)
      } else {
        content = await chatViaThirdParty(settings, messages)
      }
      onDelta?.(content)
      onDone?.()
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('对话失败'))
    }
  })()

  return () => {}
}
