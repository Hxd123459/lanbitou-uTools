import { getAllTagNamesForAi } from '../storage/utools/tagRepository'
import { loadAiSettings } from '../storage/utools/aiSettings'
import { generateTitleViaThirdParty, testThirdPartyConnection } from './thirdPartyAi'

export function isUtoolsAiAvailable() {
  return typeof window !== 'undefined' && typeof window.utools?.ai === 'function'
}

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

export function buildTitlePrompt(existingTagNames = []) {
  const existTags = existingTagNames.length
    ? existingTagNames.join('、')
    : '（暂无）'

  return `你是笔记分类助手。根据用户内容选择或生成一个粗粒度标签作为标题。
严格遵守以下规则：
1. 先判断内容是否与【已有粗标签列表】中任何一个完全匹配。
2. 只有完全匹配才能选择已有标签；只要不匹配，必须生成全新粗标签。
3. title：粗粒度标签（2-4个字），用于分类归档，最多不超过5个字。
4. 必须输出严格合法 JSON，不能有换行、注释、多余字符。

已有粗标签列表：${existTags}

输出格式：{"title":"粗分类"}`
}

async function generateViaUtools(systemPrompt, userContent, model) {
  if (!isUtoolsAiAvailable()) return null

  const option = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  }
  if (model) option.model = model

  const result = await window.utools.ai(option)
  return parseTitleFromContent(result?.content)
}

export async function generateNoteTitle(rawContent) {
  const text = String(rawContent ?? '').trim()
  if (!text) return null

  const settings = loadAiSettings()
  const systemPrompt = buildTitlePrompt(await getAllTagNamesForAi())

  try {
    if (settings.provider === 'utools') {
      return await generateViaUtools(systemPrompt, text, settings.model)
    }

    if (settings.provider === 'openai' || settings.provider === 'anthropic') {
      return await generateTitleViaThirdParty(settings, systemPrompt, text)
    }
  } catch (error) {
    console.warn('[烂笔头] AI 标题生成失败，将使用本地兜底', error)
    return null
  }

  return null
}

export async function testAiConnection(partialSettings) {
  const saved = loadAiSettings()
  const settings = {
    ...saved,
    ...partialSettings,
    apiKey: partialSettings?.apiKey ?? saved.apiKey,
    baseUrl: partialSettings?.baseUrl ?? saved.baseUrl,
  }

  if (settings.provider === 'utools') {
    if (!isUtoolsAiAvailable()) {
      throw new Error('当前环境不支持 uTools AI')
    }
    const option = {
      messages: [
        { role: 'system', content: '你是一个连通性测试助手。只回复 OK，不要输出其他内容。' },
        { role: 'user', content: 'ping' },
      ],
    }
    if (settings.model) option.model = settings.model
    const result = await window.utools.ai(option)
    if (!String(result?.content || '').trim()) {
      throw new Error('uTools AI 未返回内容')
    }
    return true
  }

  return testThirdPartyConnection(settings)
}
