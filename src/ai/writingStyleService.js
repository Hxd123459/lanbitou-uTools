import { NOTE_PREFIX } from '../storage/utools/constants'
import { dbAllDocs } from '../storage/utools/dbClient'
import { loadAiSettings } from '../storage/utools/aiSettings'

const MAX_SAMPLES = 5
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

export function isMimicWritingStyleEnabled() {
  const settings = loadAiSettings()
  return settings.mimicWritingStyle !== false
}

export async function collectFragmentStyleSamples({ excludeIds = [] } = {}) {
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
    .slice(0, MAX_SAMPLES)

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

export async function resolveWritingStylePromptSection({ excludeIds = [] } = {}) {
  if (!isMimicWritingStyleEnabled()) return ''

  try {
    const samples = await collectFragmentStyleSamples({ excludeIds })
    return buildWritingStylePromptBlock(samples)
  } catch (error) {
    console.warn('[烂笔头] 文风样本抽取失败，将跳过模仿', error)
    return ''
  }
}
