import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import { isUtoolsAiAvailable } from './aiService'
import { callThirdPartyChat } from './thirdPartyAi'

/** 低于该长度的文本没有明显的"节奏均匀"特征，重写收益小，直接跳过 */
const MIN_HUMANIZE_CHARS = 120
const HUMANIZE_MAX_TOKENS = 4096

const HUMANIZE_SYSTEM_BASE = `你是文字改写助手。用户提供一段 AI 生成的中文草稿，请改写它，去掉典型的"AI 味"，让它读起来像人随手写的。

改写规则（严格遵守）：
1. 句子节奏必须不均匀：长短句交错，允许突然蹦出三五个字的短句，允许某句啰嗦一点
2. 禁止排比和对仗，禁止"不是…而是…""既…又…""一方面…另一方面…"这类句式
3. 禁止"总之""综上""首先/其次/最后"这类总结与列举套路
4. 允许轻微的口语化：语气词、小的重复、不完整的句子都可以有
5. 保留原文全部事实和关键信息，不要新增信息，不要改变观点
6. 保留 Markdown 结构：原文第一行若是 # 标题则保留标题行；小标题、列表、引用的层级保持不变；原文没有一级标题就不要新增
7. 只输出改写后的全文，禁止输出解释、说明或前后缀`

function buildHumanizeSystemPrompt(styleSection = '') {
  const style = String(styleSection ?? '').trim()
  if (!style) return HUMANIZE_SYSTEM_BASE
  return `${HUMANIZE_SYSTEM_BASE}\n\n${style}`
}

export function isHumanizeDraftEnabled(enabled) {
  if (enabled !== undefined) return enabled === true
  return false
}

async function requestHumanize(system, user) {
  const settings = loadAiSettings()

  if (settings.provider === 'utools') {
    if (!isUtoolsAiAvailable()) throw new Error('当前环境不支持 uTools AI')
    const option = {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }
    if (settings.model) option.model = settings.model
    const result = await window.utools.ai(option)
    return String(result?.content || '')
  }

  return callThirdPartyChat({
    provider: settings.provider,
    apiKey: settings.apiKey,
    baseUrl: getResolvedBaseUrl(settings),
    model: getResolvedModel(settings),
    system,
    user,
    maxTokens: HUMANIZE_MAX_TOKENS,
  })
}

/** 改写结果丢失过多内容视为失败（模型偷懒或截断），回退原文 */
function isAcceptableRewrite(original, rewritten) {
  const result = String(rewritten ?? '').trim()
  if (!result) return false
  return result.length >= original.length * 0.5
}

/**
 * 对 AI 草稿做一轮"去 AI 味"重写。
 * 开关关闭、文本过短或重写失败时，原样返回，绝不阻断草稿流程。
 */
export async function humanizeDraftText(text, { styleSection = '', enabled = false } = {}) {
  const original = String(text ?? '').trim()
  if (!original || original.length < MIN_HUMANIZE_CHARS) return original
  if (!isHumanizeDraftEnabled(enabled)) return original

  try {
    const system = buildHumanizeSystemPrompt(styleSection)
    const rewritten = await requestHumanize(system, original)
    if (isAcceptableRewrite(original, rewritten)) {
      return String(rewritten).trim()
    }
    console.warn('[烂笔头] 去AI味重写结果异常，已回退原稿')
    return original
  } catch (error) {
    console.warn('[烂笔头] 去AI味重写失败，已回退原稿', error)
    return original
  }
}
