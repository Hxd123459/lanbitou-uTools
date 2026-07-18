import { ref } from 'vue'
import { NOTE_PREFIX, STRUCT_NOTE_PREFIX } from '../storage/utools/constants'
import { dbAllDocs } from '../storage/utools/dbClient'
import { loadAiSettings, getResolvedBaseUrl, getResolvedModel } from '../storage/utools/aiSettings'
import {
  PROFILE_TYPES,
  clearCheckpoint,
  countActiveFragments,
  loadCheckpoint,
  loadProfile,
  saveCheckpoint,
  saveProfile,
  shouldReanalyze,
} from '../storage/utools/profileRepository'
import { formatDateTime } from '../storage/utools/utils'
import { isUtoolsAiAvailable } from './aiService'
import { callThirdPartyChat } from './thirdPartyAi'

/** 采样与分批参数：控制单次分析的 token 成本上限 */
const MAX_FRAGMENT_SAMPLES = 300
const MAX_FRAGMENT_CHARS = 400
const MIN_FRAGMENT_CHARS = 12
const MAX_STRUCT_NOTES = 20
const STRUCT_EXCERPT_CHARS = 500
const MAX_BATCH_CHARS = 6000
const MAX_BATCHES = 12
const CHECKPOINT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const ANALYSIS_MAX_TOKENS = 2000

export const profileAnalysisRunning = ref(false)
/** 分析完成后递增，供设置页即时刷新卡片 */
export const profileRevision = ref(0)

let runningPromise = null

// ---------- 采样 ----------

function stripDoc(doc) {
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

function truncate(text, maxLen) {
  const value = String(text ?? '').trim()
  if (value.length <= maxLen) return value
  return `${value.slice(0, maxLen)}…`
}

/** 从数组中均匀抽取 count 条，保持时间分布 */
function evenlySample(items, count) {
  if (items.length <= count) return [...items]
  const step = items.length / count
  const result = []
  for (let i = 0; i < count; i += 1) {
    result.push(items[Math.floor(i * step)])
  }
  return result
}

function monthsAgo(dateTimeText) {
  const time = new Date(String(dateTimeText || '').replace(' ', 'T')).getTime()
  if (Number.isNaN(time)) return Infinity
  return (Date.now() - time) / (30 * 24 * 60 * 60 * 1000)
}

/** 时间加权分层采样：近 6 个月 60%，6-18 个月 30%，更早 10% */
async function sampleFragments() {
  const docs = await dbAllDocs(NOTE_PREFIX)
  const candidates = (docs || [])
    .map(stripDoc)
    .filter((doc) => doc?.id && !doc.deletedAt && !doc.archivedAt)
    .map((doc) => ({ text: getNoteText(doc), createTime: doc.createTime || '' }))
    .filter((item) => item.text.length >= MIN_FRAGMENT_CHARS)
    .sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)))

  const recent = candidates.filter((item) => monthsAgo(item.createTime) <= 6)
  const mid = candidates.filter((item) => {
    const age = monthsAgo(item.createTime)
    return age > 6 && age <= 18
  })
  const old = candidates.filter((item) => monthsAgo(item.createTime) > 18)

  const picked = [
    ...evenlySample(recent, Math.round(MAX_FRAGMENT_SAMPLES * 0.6)),
    ...evenlySample(mid, Math.round(MAX_FRAGMENT_SAMPLES * 0.3)),
    ...evenlySample(old, Math.round(MAX_FRAGMENT_SAMPLES * 0.1)),
  ]

  return picked.map((item) => truncate(item.text, MAX_FRAGMENT_CHARS))
}

/** 长文抽段：每篇取开头/中间/结尾各一段，文风与主题信息已足够 */
async function sampleStructNoteExcerpts() {
  let docs = []
  try {
    docs = (await dbAllDocs(STRUCT_NOTE_PREFIX)) || []
  } catch {
    return []
  }

  const notes = docs
    .map(stripDoc)
    .filter((doc) => doc?.id && !doc.deletedAt)
    .map((doc) => ({
      title: String(doc.title || '').trim(),
      content: String(doc.content || '').replace(/\s+/g, ' ').trim(),
      updateTime: doc.updateTime || doc.createTime || '',
    }))
    .filter((item) => item.content.length >= MIN_FRAGMENT_CHARS)
    .sort((a, b) => String(b.updateTime).localeCompare(String(a.updateTime)))
    .slice(0, MAX_STRUCT_NOTES)

  const excerpts = []
  for (const note of notes) {
    const { content } = note
    const parts = []
    if (content.length <= STRUCT_EXCERPT_CHARS * 3) {
      parts.push(content)
    } else {
      const midStart = Math.floor(content.length / 2 - STRUCT_EXCERPT_CHARS / 2)
      parts.push(content.slice(0, STRUCT_EXCERPT_CHARS))
      parts.push(content.slice(midStart, midStart + STRUCT_EXCERPT_CHARS))
      parts.push(content.slice(-STRUCT_EXCERPT_CHARS))
    }
    for (const part of parts) {
      excerpts.push(note.title ? `《${note.title}》节选：${part}` : part)
    }
  }
  return excerpts
}

function packIntoBatches(samples) {
  const batches = []
  let current = []
  let currentChars = 0

  for (const text of samples) {
    if (currentChars + text.length > MAX_BATCH_CHARS && current.length) {
      batches.push(current)
      current = []
      currentChars = 0
      if (batches.length >= MAX_BATCHES) break
    }
    current.push(text)
    currentChars += text.length
  }
  if (current.length && batches.length < MAX_BATCHES) batches.push(current)
  return batches
}

// ---------- 模型调用 ----------

async function requestAnalysis(system, user) {
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
    maxTokens: ANALYSIS_MAX_TOKENS,
    jsonMode: settings.provider === 'openai',
  })
}

function parseJsonFromContent(content) {
  const text = String(content ?? '').trim()
  if (!text) return null

  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(unfenced)
  } catch {
    // 继续尝试截取首个 JSON 对象
  }

  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(unfenced.slice(start, end + 1))
    } catch {
      return null
    }
  }
  return null
}

// ---------- Prompt ----------

const MAP_SYSTEM_PROMPT = `你是文本分析助手。用户会提供 TA 本人写的若干笔记片段，请从两个维度提炼要点：
1. style（写作风格）：句长、语气、口癖、标点习惯、高频用词、表达方式。要求具体可执行，如"平均句长约15字""句尾常用'吧'"，禁止"文笔流畅"这类空泛评价。
2. persona（用户画像）：兴趣主题、关注领域、观点立场、记录场景。

只依据文本本身归纳，不要臆测。输出严格合法 JSON（不要 markdown、不要解释）：
{"style":["要点1","要点2"],"persona":["要点1","要点2"]}
每个维度 3-8 条，中文。`

const REDUCE_STYLE_SYSTEM_PROMPT = `你是写作风格归纳专家。用户提供了多批次分析得到的风格要点列表，请去重、合并、提炼成一张结构化文风卡片。
所有字段必须是具体可执行的规则（供另一个 AI 模仿该用户写作时遵循），禁止空泛评价。
输出严格合法 JSON（不要 markdown、不要解释）：
{"tone":"整体语气一句话","sentence":"句式与句长规则一句话","habits":["表达习惯1","表达习惯2"],"vocabulary":["高频词或口癖1","高频词或口癖2"],"taboo":["该用户不会有的表达1","不会有的表达2"],"summary":"30字内一句话概括"}`

const REDUCE_PERSONA_SYSTEM_PROMPT = `你是用户画像归纳专家。用户提供了多批次分析得到的画像要点列表，请去重、合并、按重要性排序，提炼成一张结构化画像卡片。
只依据要点归纳，不要臆测。输出严格合法 JSON（不要 markdown、不要解释）：
{"interests":["兴趣主题1","兴趣主题2"],"domains":["关注领域1","关注领域2"],"stances":["观点立场1","观点立场2"],"scenes":["记录场景1","记录场景2"],"summary":"30字内一句话概括"}`

function buildMapUserContent(batch) {
  return batch.map((text, index) => `【片段${index + 1}】${text}`).join('\n')
}

function toLines(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
}

export function buildStylePromptText(card) {
  if (!card) return ''
  const lines = []
  if (card.tone) lines.push(`- 语气：${card.tone}`)
  if (card.sentence) lines.push(`- 句式：${card.sentence}`)
  const habits = toLines(card.habits)
  if (habits.length) lines.push(`- 表达习惯：${habits.join('；')}`)
  const vocabulary = toLines(card.vocabulary)
  if (vocabulary.length) lines.push(`- 常用词与口癖：${vocabulary.join('、')}`)
  const taboo = toLines(card.taboo)
  if (taboo.length) lines.push(`- 避免出现：${taboo.join('；')}`)
  if (!lines.length) return ''

  return `写作风格档案（依据用户历史笔记归纳，生成内容必须遵循以下规则）：
${lines.join('\n')}`
}

export function buildPersonaPromptText(card) {
  if (!card) return ''
  const lines = []
  const interests = toLines(card.interests)
  if (interests.length) lines.push(`- 兴趣主题：${interests.join('、')}`)
  const domains = toLines(card.domains)
  if (domains.length) lines.push(`- 关注领域：${domains.join('、')}`)
  const stances = toLines(card.stances)
  if (stances.length) lines.push(`- 观点立场：${stances.join('；')}`)
  const scenes = toLines(card.scenes)
  if (scenes.length) lines.push(`- 记录场景：${scenes.join('、')}`)
  if (!lines.length) return ''

  return `用户画像（依据用户历史笔记归纳，帮助你理解用户背景，请勿直接向用户复述）：
${lines.join('\n')}`
}

// ---------- 主流程 ----------

async function prepareCheckpoint(activeCount) {
  const existing = await loadCheckpoint()
  if (existing?.batches?.length) {
    const createdTime = new Date(String(existing.createdAt || '').replace(' ', 'T')).getTime()
    const fresh = !Number.isNaN(createdTime) && Date.now() - createdTime < CHECKPOINT_MAX_AGE_MS
    if (fresh && existing.nextBatchIndex < existing.batches.length) {
      return existing
    }
  }

  const [fragments, excerpts] = await Promise.all([
    sampleFragments(),
    sampleStructNoteExcerpts(),
  ])
  const samples = [...fragments, ...excerpts]
  if (!samples.length) return null

  const checkpoint = {
    createdAt: formatDateTime(),
    source: { analyzedCount: activeCount },
    batches: packIntoBatches(samples),
    nextBatchIndex: 0,
    mapResults: [],
  }
  await saveCheckpoint(checkpoint)
  return checkpoint
}

async function runMapPhase(checkpoint) {
  const { batches } = checkpoint
  for (let i = checkpoint.nextBatchIndex; i < batches.length; i += 1) {
    const content = await requestAnalysis(MAP_SYSTEM_PROMPT, buildMapUserContent(batches[i]))
    const parsed = parseJsonFromContent(content)
    checkpoint.mapResults.push({
      style: toLines(parsed?.style),
      persona: toLines(parsed?.persona),
    })
    checkpoint.nextBatchIndex = i + 1
    await saveCheckpoint(checkpoint)
  }
  return checkpoint
}

async function reduceCard(systemPrompt, findings) {
  if (!findings.length) return null
  const user = findings.map((item, index) => `${index + 1}. ${item}`).join('\n')
  const content = await requestAnalysis(systemPrompt, user)
  return parseJsonFromContent(content)
}

function isAiConfigured(settings) {
  if (settings.provider === 'utools') return isUtoolsAiAvailable()
  return !!settings.apiKey
}

/**
 * 执行画像与文风分析。force 为 false 时先做 shouldReanalyze 阈值检查。
 * 并发调用会复用同一个进行中的 Promise。
 */
export async function runProfileAnalysis({ force = false } = {}) {
  if (runningPromise) return runningPromise

  runningPromise = (async () => {
    if (!isAiConfigured(loadAiSettings())) {
      if (force) throw new Error('请先在设置中配置 AI 服务')
      return { ok: false, reason: 'ai-unavailable' }
    }
    if (!force && !(await shouldReanalyze())) {
      return { ok: false, reason: 'not-needed' }
    }

    profileAnalysisRunning.value = true
    try {
      const activeCount = await countActiveFragments()
      const checkpoint = await prepareCheckpoint(activeCount)
      if (!checkpoint) return { ok: false, reason: 'no-samples' }

      await runMapPhase(checkpoint)

      const styleFindings = checkpoint.mapResults.flatMap((item) => item.style)
      const personaFindings = checkpoint.mapResults.flatMap((item) => item.persona)
      const source = {
        analyzedCount: checkpoint.source?.analyzedCount ?? activeCount,
        sampleCount: checkpoint.batches.reduce((sum, batch) => sum + batch.length, 0),
      }

      const [existingStyle, existingPersona] = await Promise.all([
        loadProfile(PROFILE_TYPES.writingStyle),
        loadProfile(PROFILE_TYPES.persona),
      ])

      if (!existingStyle?.manualLocked) {
        const card = await reduceCard(REDUCE_STYLE_SYSTEM_PROMPT, styleFindings)
        const promptText = buildStylePromptText(card)
        if (card && promptText) {
          await saveProfile(PROFILE_TYPES.writingStyle, { card, promptText, source })
        }
      }

      if (!existingPersona?.manualLocked) {
        const card = await reduceCard(REDUCE_PERSONA_SYSTEM_PROMPT, personaFindings)
        const promptText = buildPersonaPromptText(card)
        if (card && promptText) {
          await saveProfile(PROFILE_TYPES.persona, { card, promptText, source })
        }
      }

      await clearCheckpoint()
      profileRevision.value += 1
      return { ok: true, analyzedCount: source.analyzedCount }
    } finally {
      profileAnalysisRunning.value = false
    }
  })()

  try {
    return await runningPromise
  } finally {
    runningPromise = null
  }
}

/** 惰性后台触发：静默执行，失败只告警，不打扰用户 */
export function maybeRunProfileAnalysis() {
  if (typeof window === 'undefined' || !window.utools?.db) return
  runProfileAnalysis({ force: false }).catch((error) => {
    console.warn('[烂笔头] 画像后台分析失败，将在下次触发时重试', error)
  })
}
