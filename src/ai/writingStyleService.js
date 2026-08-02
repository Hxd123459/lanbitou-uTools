import { NOTE_PREFIX } from '../storage/utools/constants'
import { dbAllDocs } from '../storage/utools/dbClient'
import { PROFILE_TYPES, loadProfile } from '../storage/utools/profileRepository'

const MAX_SAMPLES = 5
/** 有文风卡片时只需少量鲜活样本补充，卡片承担稳定规则 */
const MAX_SAMPLES_WITH_CARD = 3
const MIN_SAMPLE_LEN = 12
const MAX_SAMPLE_CHARS = 280

function stripNoteDoc(doc) {
  if (!doc) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

function getNoteText(note) {
  return String(
    note?.markdownContent || note?.rawContent || note?.summary || note?.text || '',
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateSample(text, maxLen = MAX_SAMPLE_CHARS) {
  const value = String(text ?? '').trim()
  if (value.length <= maxLen) return value
  return `${value.slice(0, maxLen)}…`
}

export function isMimicWritingStyleEnabled(enabled) {
  if (enabled !== undefined) return enabled === true
  return false
}

export async function collectFragmentStyleSamples({ excludeIds = [], limit = MAX_SAMPLES } = {}) {
  const excludeSet = new Set(
    (Array.isArray(excludeIds) ? excludeIds : []).map(String).filter(Boolean),
  )

  const docs = await dbAllDocs(NOTE_PREFIX)
  const candidates = (docs || [])
    .map(stripNoteDoc)
    .filter((doc) => doc?.id && !doc.deletedAt && !doc.archivedAt)
    .filter((doc) => !excludeSet.has(String(doc.id)))
    .map((doc) => ({
      id: doc.id,
      text: getNoteText(doc),
      createTime: doc.createTime || '',
    }))
    .filter((item) => item.text.length >= MIN_SAMPLE_LEN)
    .sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)))
    .slice(0, limit)

  return candidates.map((item) => truncateSample(item.text))
}

export function buildWritingStylePromptBlock(samples = []) {
  const list = (Array.isArray(samples) ? samples : []).filter(Boolean)
  if (!list.length) return ''

  const examples = list
    .map((text, index) => `示例${index + 1}：${text}`)
    .join('\n')

  return `写作风格参考（以下均为用户本人手写碎片，请模仿其用词、句长、语气与表达习惯，但不要照抄内容）：
${examples}`
}

export async function resolveWritingStylePromptSection({
  excludeIds = [],
  enabled = false,
} = {}) {
  if (!isMimicWritingStyleEnabled(enabled)) return ''

  try {
    const profile = await loadProfile(PROFILE_TYPES.writingStyle)
    const cardPrompt = String(profile?.promptText || '').trim()

    const samples = await collectFragmentStyleSamples({
      excludeIds,
      limit: cardPrompt ? MAX_SAMPLES_WITH_CARD : MAX_SAMPLES,
    })
    const samplesBlock = buildWritingStylePromptBlock(samples)

    return [cardPrompt, samplesBlock].filter(Boolean).join('\n\n')
  } catch (error) {
    console.warn('[烂笔头] 文风样本抽取失败，将跳过模仿', error)
    return ''
  }
}
