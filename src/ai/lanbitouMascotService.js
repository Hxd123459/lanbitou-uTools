import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import { isUtoolsAiAvailable } from './aiService'
import { callThirdPartyChat } from './thirdPartyAi'

const SYSTEM_PROMPT = `你是「烂笔头」吉祥物，话痨、有趣、温暖，略皮但不油腻。
用户刚记录了一条碎片笔记，请用 1～2 句话：
1. 点出他大概记了什么（概括即可，不要逐字复读）
2. 给一点轻松、有趣的小反馈或联想

硬性要求：
- 总共不超过 60 个汉字
- 禁止说教、禁止「你应该」
- 像朋友在旁边嘀咕，可以适度口语化
- 只输出要说的话，不要 markdown、不要引号包裹`

function buildUserPrompt({ text, tagName, hasImages }) {
  const parts = []
  if (tagName) parts.push(`标签：${tagName}`)
  if (text?.trim()) parts.push(`内容：${text.trim()}`)
  if (hasImages) parts.push('（含图片附件）')
  if (!parts.length) return '用户刚记了一条空笔记'
  return parts.join('\n')
}

function sanitizeReply(raw) {
  return String(raw ?? '')
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function buildFallbackFeedback({ text, tagName, hasImages }) {
  const snippet = String(text ?? '').trim().replace(/\s+/g, ' ')
  if (snippet) {
    const brief = snippet.length > 18 ? `${snippet.slice(0, 18)}…` : snippet
    if (tagName) return `记下「${brief}」了，${tagName} 文件夹又胖了一点～`
    return `收到！「${brief}」——好记性不如烂笔头嘛`
  }
  if (hasImages) return '图片我收下了，下次记得配两句字幕呀'
  if (tagName) return `给 ${tagName} 添了一条，虽然啥也没写…也算记了！`
  return '空着也记下来了，烂笔头从不挑食'
}

async function requestUtoolsFeedback(systemPrompt, userPrompt, model) {
  if (!isUtoolsAiAvailable()) return null
  const option = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  }
  if (model) option.model = model
  const result = await window.utools.ai(option)
  return sanitizeReply(result?.content)
}

async function requestThirdPartyFeedback(settings, systemPrompt, userPrompt) {
  const content = await callThirdPartyChat({
    provider: settings.provider,
    apiKey: settings.apiKey,
    baseUrl: getResolvedBaseUrl(settings),
    model: getResolvedModel(settings),
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 120,
    jsonMode: false,
  })
  return sanitizeReply(content)
}

export async function generateMascotFragmentFeedback(payload = {}) {
  const userPrompt = buildUserPrompt(payload)
  const settings = loadAiSettings()

  try {
    if (settings.provider === 'utools') {
      const reply = await requestUtoolsFeedback(SYSTEM_PROMPT, userPrompt, settings.model)
      if (reply) return reply
    }

    if (settings.provider === 'openai' || settings.provider === 'anthropic') {
      if (settings.apiKey) {
        const reply = await requestThirdPartyFeedback(settings, SYSTEM_PROMPT, userPrompt)
        if (reply) return reply
      }
    }
  } catch (error) {
    console.warn('[烂笔头吉祥物] AI 反馈失败，使用兜底文案', error)
  }

  return buildFallbackFeedback(payload)
}
