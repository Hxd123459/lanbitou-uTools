import { getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import { PROFILE_TYPES, loadProfile } from '../storage/utools/profileRepository'
import { isUtoolsAiAvailable } from './aiService'
import { buildPersonaPromptText } from './profileExtractionService'
import {
  executeNoteSearchTool,
  handleSearchFragments,
  NOTE_SEARCH_TOOL_DEFINITIONS,
  toAnthropicTools,
  toOpenAiTools,
  toUtoolsTools,
} from './noteSearchTools'

const CHAT_AGENT_SYSTEM_PROMPT = `你是烂笔头个人助理，帮助用户整理思路、回答问题。

用户可能询问自己记录的碎片笔记或沉淀长文。回答前请：
1. 需要查找时，先调用 search_fragments 搜索相关笔记
2. 找到候选后，用 get_fragment 读取完整内容再作答
3. 不确定标签时，可先调用 list_tags 了解分类

回答时引用具体笔记标题，简洁清晰，语气友好。若未找到相关笔记，如实告知。`

const MAX_TOOL_ROUNDS = 5

function safeParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function extractToolCalls(result) {
  if (!result) return []

  if (Array.isArray(result.tool_calls) && result.tool_calls.length) {
    return result.tool_calls.map((call) => ({
      id: call.id || call.tool_call_id || `${call.function?.name || 'tool'}_${Date.now()}`,
      name: call.function?.name || call.name,
      arguments: safeParseJson(call.function?.arguments || call.arguments || '{}'),
    }))
  }

  const content = String(result.content ?? '').trim()
  if (!content) return []

  if (content.startsWith('{') || content.startsWith('[')) {
    const parsed = safeParseJson(content)
    if (Array.isArray(parsed?.tool_calls)) {
      return parsed.tool_calls.map((call, index) => ({
        id: call.id || `parsed_${index}`,
        name: call.name || call.function?.name,
        arguments: call.arguments || safeParseJson(call.function?.arguments || '{}'),
      }))
    }
  }

  return []
}

async function runToolCalls(toolCalls) {
  const outputs = []
  for (const call of toolCalls) {
    if (!call?.name) continue
    try {
      const result = await executeNoteSearchTool(call.name, call.arguments || {})
      outputs.push({
        id: call.id,
        name: call.name,
        result,
      })
    } catch (error) {
      outputs.push({
        id: call.id,
        name: call.name,
        result: { error: error?.message || '工具执行失败' },
      })
    }
  }
  return outputs
}

async function runOpenAiAgent({ baseUrl, apiKey, model, messages }) {
  const tools = toOpenAiTools()
  let workingMessages = [...messages]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 2048,
        messages: workingMessages,
        tools,
        tool_choice: 'auto',
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const msg = payload?.error?.message || `OpenAI 请求失败 (${response.status})`
      throw new Error(msg)
    }

    const message = payload?.choices?.[0]?.message
    if (!message) throw new Error('AI 未返回内容')

    const toolCalls = extractToolCalls(message)
    if (!toolCalls.length) {
      const content = String(message.content || '').trim()
      if (!content) throw new Error('AI 未返回内容')
      return content
    }

    workingMessages.push(message)
    const outputs = await runToolCalls(toolCalls)
    for (const output of outputs) {
      workingMessages.push({
        role: 'tool',
        tool_call_id: output.id,
        content: JSON.stringify(output.result),
      })
    }
  }

  throw new Error('笔记检索轮次过多，请缩小问题范围后重试')
}

async function runAnthropicAgent({ baseUrl, apiKey, model, messages }) {
  const tools = toAnthropicTools()
  const system = messages.find((item) => item.role === 'system')?.content || CHAT_AGENT_SYSTEM_PROMPT
  const chatMessages = messages.filter((item) => item.role !== 'system')
  let workingMessages = [...chatMessages]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
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
        tools,
        messages: workingMessages,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const msg = payload?.error?.message || `Anthropic 请求失败 (${response.status})`
      throw new Error(msg)
    }

    const blocks = Array.isArray(payload?.content) ? payload.content : []
    const toolUses = blocks.filter((block) => block.type === 'tool_use')
    const textBlocks = blocks.filter((block) => block.type === 'text')

    if (!toolUses.length) {
      const content = textBlocks.map((block) => block.text).join('\n').trim()
      if (!content) throw new Error('AI 未返回内容')
      return content
    }

    workingMessages.push({ role: 'assistant', content: blocks })
    const outputs = []
    for (const toolUse of toolUses) {
      try {
        const result = await executeNoteSearchTool(toolUse.name, toolUse.input || {})
        outputs.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      } catch (error) {
        outputs.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: error?.message || '工具执行失败' }),
          is_error: true,
        })
      }
    }
    workingMessages.push({ role: 'user', content: outputs })
  }

  throw new Error('笔记检索轮次过多，请缩小问题范围后重试')
}

async function enrichUtoolsMessagesWithSearchHints(messages) {
  const lastUser = [...messages].reverse().find((item) => item.role === 'user')
  const userText = String(lastUser?.content || '').trim()
  if (!userText || userText.includes('引用碎片：')) return messages

  const query = userText.split('\n')[0].trim().slice(0, 80)
  if (query.length < 2) return messages

  const search = await handleSearchFragments({ keywords: query, limit: 6 })
  if (!search.items?.length) return messages

  const hint = {
    role: 'system',
    content:
      `已预检索到以下可能相关的笔记（供参考，可用 get_fragment 读取详情）：\n${
        JSON.stringify(search.items, null, 2)
      }`,
  }

  const systemIdx = messages.findIndex((item) => item.role === 'system')
  const next = [...messages]
  next.splice(systemIdx + 1, 0, hint)
  return next
}

async function runUtoolsAgent({ messages, model }) {
  if (!isUtoolsAiAvailable()) {
    throw new Error('当前环境不支持 uTools AI')
  }

  const tools = toUtoolsTools()
  const seededMessages = await enrichUtoolsMessagesWithSearchHints(messages)
  const option = {
    messages: seededMessages,
    tools,
  }
  if (model) option.model = model

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const result = await window.utools.ai(option)
    const toolCalls = extractToolCalls(result)

    if (!toolCalls.length) {
      const content = String(result?.content || '').trim()
      if (!content) throw new Error('AI 未返回内容')
      return content
    }

    option.messages = [...option.messages, {
      role: 'assistant',
      content: result?.content || '',
      tool_calls: result.tool_calls,
    }]

    const outputs = await runToolCalls(toolCalls)
    for (const output of outputs) {
      option.messages.push({
        role: 'tool',
        tool_call_id: output.id,
        content: JSON.stringify(output.result),
      })
    }
  }

  throw new Error('笔记检索轮次过多，请缩小问题范围后重试')
}

async function resolvePersonaPromptSection() {
  try {
    const persona = await loadProfile(PROFILE_TYPES.persona)
    const profileText =
      buildPersonaPromptText(persona?.card) || String(persona?.promptText || '').trim()
    if (!profileText) return ''
    return `${profileText}

使用边界：
- 上述深层洞察只是概率性假设，不是事实或心理诊断。
- 不要主动向用户复述画像或给用户贴标签。
- 若用户当前表达与画像冲突，以用户当前表达为准。`
  } catch {
    return ''
  }
}

export async function buildAgentMessages(history, userMessage) {
  const personaSection = await resolvePersonaPromptSection()
  const system = personaSection
    ? `${CHAT_AGENT_SYSTEM_PROMPT}\n\n${personaSection}`
    : CHAT_AGENT_SYSTEM_PROMPT

  const messages = [{ role: 'system', content: system }]
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content })
    }
  }
  messages.push({ role: 'user', content: userMessage })
  return messages
}

export async function runChatWithNoteTools(settings, { history, userMessage }) {
  const messages = await buildAgentMessages(history, userMessage)

  if (settings.provider === 'utools') {
    return runUtoolsAgent({ messages, model: settings.model })
  }

  const baseUrl = getResolvedBaseUrl(settings)
  const model = getResolvedModel(settings)
  const { apiKey } = settings
  if (!apiKey) throw new Error('请先在设置中填写 API Key')

  if (settings.provider === 'openai') {
    return runOpenAiAgent({ baseUrl, apiKey, model, messages })
  }
  if (settings.provider === 'anthropic') {
    return runAnthropicAgent({ baseUrl, apiKey, model, messages })
  }

  throw new Error('不支持的 AI 服务商')
}

export { CHAT_AGENT_SYSTEM_PROMPT, NOTE_SEARCH_TOOL_DEFINITIONS }
