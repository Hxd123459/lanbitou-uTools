import { getAllTagNamesForAi } from '../storage/utools/tagRepository'
import { loadAiSettings } from '../storage/utools/aiSettings'
import { generateTitleViaThirdParty, testThirdPartyConnection } from './thirdPartyAi'
import { parseTitleResultFromAssistantMessage } from './titleParser'

export function isUtoolsAiAvailable() {
  return typeof window !== 'undefined' && typeof window.utools?.ai === 'function'
}

export function shouldAutoTagContent(rawContent) {
  const text = String(rawContent ?? '').trim()
  if (!text) return false

  const compact = text.replace(/\s+/g, '')
  if (compact.length <= 3) return false

  if (!/[\u4e00-\u9fffA-Za-z]/.test(compact)) return false

  const hasClauseBreak = /[，。！？；：、,.!?;:]/.test(text)
  const hasMultipleTokens = /\s/.test(text)
  if (compact.length <= 5 && !hasClauseBreak && !hasMultipleTokens) {
    return false
  }

  return true
}

const VAGUE_AUTO_TAGS = new Set([
  '无意义',
  '未知',
  '其他',
  '杂项',
  '未分类',
  '随便',
  '测试',
  '暂无',
])

function isVagueAutoTag(title) {
  const value = String(title ?? '').trim()
  if (!value) return true
  return VAGUE_AUTO_TAGS.has(value)
}

export function buildTitlePrompt(existingTagNames = []) {
  const existTags = existingTagNames.length
    ? existingTagNames.join('、')
    : '（暂无）'

  return `你是笔记分类助手。根据用户内容选择或生成一个粗粒度标签作为标题。
严格遵守以下规则：
1. 先判断内容是否与【已有粗标签列表】中任何一个完全匹配。
2. 只有完全匹配才能选择已有标签；只要不匹配，必须生成全新粗标签。
3. title：粗粒度标签（2-5个字），用于分类归档，最多不超过5个字。
4. 无法判断主题或语义不清时，必须输出 {"title":"意义不明"}，禁止编造其他标签。
5. 禁止输出思考过程、推理、解释或 markdown。
6. 必须输出严格合法 JSON，不能有换行、注释、多余字符。

已有粗标签列表：${existTags}

输出格式：{"title":"粗分类"}`
}

async function requestUtoolsTitleMessage(systemPrompt, userContent, model) {
  if (!isUtoolsAiAvailable()) return null

  const option = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  }
  if (model) option.model = model

  return window.utools.ai(option)
}

export async function generateNoteTitle(rawContent) {
  const text = String(rawContent ?? '').trim()
  if (!text || !shouldAutoTagContent(text)) return null

  const settings = loadAiSettings()
  const systemPrompt = buildTitlePrompt(await getAllTagNamesForAi())

  const acceptTitle = (value) => {
    const title = String(value ?? '').trim()
    if (!title || isVagueAutoTag(title)) return null
    return title
  }

  const resolveTitleMessage = async (message) => {
    const { title, resolved } = parseTitleResultFromAssistantMessage(message)
    if (!resolved) return { done: false, title: null }
    return { done: true, title: acceptTitle(title) }
  }

  try {
    if (settings.provider === 'utools') {
      let result = await resolveTitleMessage(
        await requestUtoolsTitleMessage(systemPrompt, text, settings.model),
      )
      if (result.done) return result.title

      const strictPrompt = `${systemPrompt}

最后提醒：不要输出思考过程，立即直接输出 JSON；无法判断主题或语义不清时输出 {"title":"意义不明"}，否则输出 {"title":"标签"}。`
      result = await resolveTitleMessage(
        await requestUtoolsTitleMessage(strictPrompt, text, settings.model),
      )
      if (result.done) return result.title
      return null
    }

    if (settings.provider === 'openai' || settings.provider === 'anthropic') {
      return acceptTitle(
        await generateTitleViaThirdParty(settings, systemPrompt, text),
      )
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
