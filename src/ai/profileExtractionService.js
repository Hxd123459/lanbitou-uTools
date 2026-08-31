import { ref } from 'vue'
import { NOTE_PREFIX, STRUCT_NOTE_PREFIX } from '../storage/utools/constants'
import { dbAllDocs } from '../storage/utools/dbClient'
import {
  loadAiSettings,
  getResolvedBaseUrl,
  getResolvedModel,
  isAutoProfileAnalysisEnabled,
  isOpenAiCompatible,
  isThirdPartyConfigured,
} from '../storage/utools/aiSettings'
import {
  PROFILE_TYPES,
  PROFILE_SCHEMA_VERSION,
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
const ANALYSIS_MAX_TOKENS = 4096

export const profileAnalysisRunning = ref(false)
export const profileAnalysisProgress = ref({
  stage: 'idle',
  message: '',
  percent: 0,
  processedBatches: 0,
  totalBatches: 0,
  processedSamples: 0,
  totalSamples: 0,
  fragmentSamples: 0,
  structNotes: 0,
})
/** 分析完成后递增，供设置页即时刷新卡片 */
export const profileRevision = ref(0)

let runningPromise = null

function updateProgress(patch) {
  profileAnalysisProgress.value = {
    ...profileAnalysisProgress.value,
    ...patch,
  }
}

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
    .map((doc) => ({
      sourceId: String(doc.id),
      sourceType: 'fragment',
      title: String(doc.title || doc.fineTitle || '').trim(),
      excerpt: getNoteText(doc),
      time: doc.updateTime || doc.createTime || '',
      createTime: doc.createTime || '',
    }))
    .filter((item) => item.excerpt.length >= MIN_FRAGMENT_CHARS)
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

  return picked.map((item) => ({
    sampleKey: `fragment:${item.sourceId}`,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    title: item.title,
    time: item.time,
    excerpt: truncate(item.excerpt, MAX_FRAGMENT_CHARS),
  }))
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
      id: String(doc.id),
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
    for (let index = 0; index < parts.length; index += 1) {
      excerpts.push({
        sampleKey: `structNote:${note.id}:${index}`,
        sourceType: 'structNote',
        sourceId: note.id,
        title: note.title,
        time: note.updateTime,
        excerpt: parts[index],
      })
    }
  }
  return excerpts
}

function packIntoBatches(samples) {
  const batches = []
  let current = []
  let currentChars = 0

  for (const sample of samples) {
    const sampleChars = sample.excerpt.length
    if (currentChars + sampleChars > MAX_BATCH_CHARS && current.length) {
      batches.push(current)
      current = []
      currentChars = 0
      if (batches.length >= MAX_BATCHES) break
    }
    current.push(sample)
    currentChars += sampleChars
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
    jsonMode: isOpenAiCompatible(settings.provider),
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

const DEEP_CATEGORIES = [
  'thinkingPattern',
  'decisionPreference',
  'emotionalPattern',
  'unfinishedLifeTheme',
]

const MAP_SYSTEM_PROMPT = `你是严谨的数字人格研究助手。输入是同一位用户在不同时间写下的记录。你的任务不是贴标签，而是提出可验证、可被反证的人格假设。

分析三层内容：
1. style：具体写作习惯。
2. surface：兴趣主题、关注领域、观点立场、记录场景。
3. findings：
   - thinkingPattern：如何处理信息、归因、抽象、反思和修正认知
   - decisionPreference：风险偏好、行动阈值、验证方式、拖延或推进条件
   - emotionalPattern：常见触发因素、反应、调节方式、情绪后的行动倾向
   - unfinishedLifeTheme：跨时间反复出现、尚未闭环的愿望、冲突、回避或长期议题

证据规则：
- 每条 finding 必须引用输入中的 sampleKey，并附原文短引；没有直接证据就不要输出。
- confidence 只能是 high、medium、low。单条证据不得高于 low；两条独立证据最多 medium；三条及以上跨时间证据才可 high。
- 主动寻找不符合该结论的反证，放入 counterEvidence。
- 禁止心理疾病诊断、道德评判、身份猜测；用“记录显示可能倾向于”而非绝对断言。
- unfinishedLifeTheme 必须有跨时间重复且无闭环迹象，否则不要输出。

输出严格合法 JSON，不要 markdown 或解释：
{
  "style":["具体规则"],
  "surface":{"interests":[],"domains":[],"stances":[],"scenes":[]},
  "findings":[{
    "category":"thinkingPattern|decisionPreference|emotionalPattern|unfinishedLifeTheme",
    "claim":"具体、可验证的洞察",
    "confidence":"high|medium|low",
    "scope":"该倾向出现的情境或边界",
    "evidence":[{"sampleKey":"输入中的key","quote":"原文短引"}],
    "counterEvidence":[{"sampleKey":"输入中的key","quote":"反证短引"}]
  }]
}`

const REDUCE_STYLE_SYSTEM_PROMPT = `你是写作风格归纳专家。用户提供了多批次分析得到的风格要点列表，请去重、合并、提炼成一张结构化文风卡片。
所有字段必须是具体可执行的规则（供另一个 AI 模仿该用户写作时遵循），禁止空泛评价。
输出严格合法 JSON（不要 markdown、不要解释）：
{"tone":"整体语气一句话","sentence":"句式与句长规则一句话","habits":["表达习惯1","表达习惯2"],"vocabulary":["高频词或口癖1","高频词或口癖2"],"taboo":["该用户不会有的表达1","不会有的表达2"],"summary":"30字内一句话概括"}`

const REDUCE_PERSONA_SYSTEM_PROMPT = `你是严谨的数字人格建模专家。输入包含多批次表层画像和带证据的人格假设。请去重合并，但不得扩大原结论。

规则：
1. 两条以上独立来源证据可进入正式洞察；只有一条证据但足够具体的可保留为 low 候选，供用户审阅，不得写成确定结论。
2. confidence 必须按证据重算：1条为 low，2条为 medium，3条及以上且跨时间可为 high；有明显反证时降一级。
3. 保留 evidence、counterEvidence 的 sampleKey 与 quote，最多各4条。
4. 矛盾表现不要强行统一，应写明 scope（什么情境下呈现什么倾向）。
5. 未完成人生主题必须跨时间重复且没有闭环证据；不满足就丢弃。
6. 禁止医学/心理诊断和道德评价。
7. 输入若包含 feedbackConstraints：rejected/hidden 的洞察不得以同义表达重新出现；confirmed 可作为用户确认信息保留，但仍需证据。

输出严格合法 JSON，不要 markdown 或解释：
{
  "summary":"40字内、概率性的人格概括",
  "surface":{"interests":[],"domains":[],"stances":[],"scenes":[]},
  "deep":{
    "thinkingPatterns":[{"insight":"","confidence":"medium|high","scope":"","evidence":[{"sampleKey":"","quote":""}],"counterEvidence":[]}],
    "decisionPreferences":[],
    "emotionalPatterns":[],
    "unfinishedLifeThemes":[]
  }
}`

function buildMapUserContent(batch) {
  return batch.map((sample) => [
    `【sampleKey:${sample.sampleKey}】`,
    `来源:${sample.sourceType} 时间:${sample.time || '未知'} 标题:${sample.title || '无'}`,
    sample.excerpt,
  ].join('\n')).join('\n\n')
}

function toLines(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
}

function normalizeSurface(surface = {}) {
  return {
    interests: toLines(surface.interests),
    domains: toLines(surface.domains),
    stances: toLines(surface.stances),
    scenes: toLines(surface.scenes),
  }
}

function mergeSurfaceLists(surfaces = []) {
  const merged = {
    interests: [],
    domains: [],
    stances: [],
    scenes: [],
  }
  for (const surface of surfaces) {
    const normalized = normalizeSurface(surface)
    for (const key of Object.keys(merged)) {
      for (const item of normalized[key]) {
        if (!merged[key].includes(item)) merged[key].push(item)
      }
    }
  }
  return {
    interests: merged.interests.slice(0, 12),
    domains: merged.domains.slice(0, 12),
    stances: merged.stances.slice(0, 12),
    scenes: merged.scenes.slice(0, 12),
  }
}

function hasSurfaceContent(surface) {
  if (!surface) return false
  return ['interests', 'domains', 'stances', 'scenes'].some(
    (key) => Array.isArray(surface[key]) && surface[key].length > 0,
  )
}

function hasDeepContent(deep) {
  if (!deep) return false
  return [
    'thinkingPatterns',
    'decisionPreferences',
    'emotionalPatterns',
    'unfinishedLifeThemes',
  ].some((key) => Array.isArray(deep[key]) && deep[key].length > 0)
}

function hasPersonaContent(card) {
  if (!card) return false
  return Boolean(
    card.summary ||
      card.manualOverride ||
      hasSurfaceContent(card.surface) ||
      hasDeepContent(card.deep),
  )
}

const CATEGORY_TO_GROUP = {
  thinkingPattern: 'thinkingPatterns',
  decisionPreference: 'decisionPreferences',
  emotionalPattern: 'emotionalPatterns',
  unfinishedLifeTheme: 'unfinishedLifeThemes',
}

function normalizeMapFinding(item, validKeys) {
  if (!item || !DEEP_CATEGORIES.includes(item.category)) return null
  const claim = String(item.claim || '').trim()
  if (!claim) return null
  const confidence = ['high', 'medium', 'low'].includes(item.confidence)
    ? item.confidence
    : 'low'
  const normalizeRefs = (refs) =>
    (Array.isArray(refs) ? refs : [])
      .map((ref) => ({
        sampleKey: resolveSampleKey(String(ref?.sampleKey || ''), validKeys),
        quote: truncate(String(ref?.quote || '').trim(), 120),
      }))
      .filter((ref) => ref.sampleKey && ref.quote)

  const evidence = normalizeRefs(item.evidence)
  if (!evidence.length) return null
  return {
    category: item.category,
    claim,
    confidence: evidence.length === 1 ? 'low' : confidence,
    scope: String(item.scope || '').trim(),
    evidence,
    counterEvidence: normalizeRefs(item.counterEvidence),
  }
}

function resolveSampleKey(rawKey, validKeys) {
  const key = String(rawKey || '').trim()
  if (!key) return ''
  if (validKeys.has(key)) return key
  // 模型常漏写前缀或只回传 id
  for (const candidate of validKeys) {
    if (candidate.endsWith(`:${key}`) || candidate === key || candidate.includes(key)) {
      return candidate
    }
  }
  return ''
}

function insightId(groupKey, insight) {
  const input = `${groupKey}:${insight}`
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `insight_${(hash >>> 0).toString(36)}`
}

function resolveEvidence(refs, sampleMap) {
  const seen = new Set()
  const validKeys = new Set(sampleMap.keys())
  return (Array.isArray(refs) ? refs : [])
    .map((ref) => {
      const key = resolveSampleKey(String(ref?.sampleKey || ''), validKeys)
      const sample = sampleMap.get(key)
      const sourceKey = sample ? `${sample.sourceType}:${sample.sourceId}` : ''
      if (!sample || seen.has(sourceKey)) return null
      seen.add(sourceKey)
      return {
        sampleKey: key,
        sourceType: sample.sourceType,
        sourceId: sample.sourceId,
        title: sample.title || '',
        time: sample.time || '',
        quote: truncate(String(ref.quote || '').trim(), 120) || truncate(sample.excerpt, 120),
        excerpt: truncate(sample.excerpt, 220),
      }
    })
    .filter(Boolean)
    .slice(0, 4)
}

function claimSimilarityKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\u4e00-\u9fff\w]/g, '')
    .slice(0, 24)
}

/** 用 Map 阶段带证据的 findings 本地合并，避免 Reduce 弄丢 sampleKey 导致全空 */
export function buildDeepFromMapFindings(findings = [], samples = [], previousCard = null) {
  const sampleMap = new Map(samples.map((sample) => [sample.sampleKey, sample]))
  const previousFeedback = previousCard?.feedback || {}
  const rejectedInsights = new Set(
    Object.values(previousFeedback)
      .filter((value) => typeof value === 'object' && value?.status === 'rejected')
      .map((value) => String(value.insight || '').trim())
      .filter(Boolean),
  )

  const buckets = {
    thinkingPatterns: new Map(),
    decisionPreferences: new Map(),
    emotionalPatterns: new Map(),
    unfinishedLifeThemes: new Map(),
  }

  for (const finding of findings) {
    const groupKey = CATEGORY_TO_GROUP[finding.category]
    if (!groupKey) continue
    const insight = String(finding.claim || '').trim()
    if (!insight || rejectedInsights.has(insight)) continue
    const evidence = resolveEvidence(finding.evidence, sampleMap)
    if (!evidence.length) continue
    const counterEvidence = resolveEvidence(finding.counterEvidence, sampleMap)
    const key = claimSimilarityKey(insight) || insightId(groupKey, insight)
    const existing = buckets[groupKey].get(key)
    if (!existing) {
      buckets[groupKey].set(key, {
        id: insightId(groupKey, insight),
        insight,
        scope: String(finding.scope || '').trim(),
        evidence,
        counterEvidence,
      })
      continue
    }
    const mergedEvidence = resolveEvidence(
      [...existing.evidence, ...evidence].map((item) => ({
        sampleKey: item.sampleKey,
        quote: item.quote,
      })),
      sampleMap,
    )
    const mergedCounter = resolveEvidence(
      [...existing.counterEvidence, ...counterEvidence].map((item) => ({
        sampleKey: item.sampleKey,
        quote: item.quote,
      })),
      sampleMap,
    )
    buckets[groupKey].set(key, {
      ...existing,
      evidence: mergedEvidence,
      counterEvidence: mergedCounter,
      scope: existing.scope || String(finding.scope || '').trim(),
    })
  }

  const deep = {}
  for (const groupKey of Object.keys(buckets)) {
    deep[groupKey] = [...buckets[groupKey].values()]
      .map((item) => {
        if (groupKey === 'unfinishedLifeThemes') {
          const months = new Set(
            item.evidence.map((entry) => String(entry.time || '').slice(0, 7)).filter(Boolean),
          )
          if (months.size < 2) return null
        }
        let confidence =
          item.evidence.length >= 3 ? 'high' : item.evidence.length === 2 ? 'medium' : 'low'
        if (item.counterEvidence.length && confidence === 'high') confidence = 'medium'
        return { ...item, confidence }
      })
      .filter(Boolean)
      .sort((a, b) => b.evidence.length - a.evidence.length)
      .slice(0, 8)
  }
  return deep
}

export function normalizePersonaCard(rawCard, samples = [], previousCard = null) {
  const sampleMap = new Map(samples.map((sample) => [sample.sampleKey, sample]))
  const previousFeedback = previousCard?.feedback || {}
  const rejectedInsights = new Set(
    Object.values(previousFeedback)
      .filter((value) => typeof value === 'object' && value?.status === 'rejected')
      .map((value) => String(value.insight || '').trim())
      .filter(Boolean),
  )
  const groups = [
    'thinkingPatterns',
    'decisionPreferences',
    'emotionalPatterns',
    'unfinishedLifeThemes',
  ]
  const deep = {}

  for (const groupKey of groups) {
    deep[groupKey] = (Array.isArray(rawCard?.deep?.[groupKey]) ? rawCard.deep[groupKey] : [])
      .map((item) => {
        const insight = String(item?.insight || '').trim()
        const evidence = resolveEvidence(item?.evidence, sampleMap)
        if (!insight || !evidence.length || rejectedInsights.has(insight)) return null
        if (groupKey === 'unfinishedLifeThemes') {
          const months = new Set(
            evidence.map((entry) => String(entry.time || '').slice(0, 7)).filter(Boolean),
          )
          if (months.size < 2) return null
        }
        const counterEvidence = resolveEvidence(item?.counterEvidence, sampleMap)
        let confidence =
          evidence.length >= 3 ? 'high' : evidence.length === 2 ? 'medium' : 'low'
        if (counterEvidence.length && confidence === 'high') confidence = 'medium'
        return {
          id: insightId(groupKey, insight),
          insight,
          confidence,
          scope: String(item?.scope || '').trim(),
          evidence,
          counterEvidence,
        }
      })
      .filter(Boolean)
  }

  return {
    summary: String(rawCard?.summary || '').trim(),
    surface: normalizeSurface(rawCard?.surface),
    deep,
    feedback: previousFeedback,
    manualOverride: previousCard?.manualOverride || '',
  }
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
  if (card.summary) lines.push(`- 概括：${card.summary}`)
  if (card.manualOverride) {
    lines.push(`- 用户手动补充：${String(card.manualOverride).trim()}`)
  }
  const surface = card.surface || card
  const interests = toLines(surface.interests)
  if (interests.length) lines.push(`- 兴趣主题：${interests.join('、')}`)
  const domains = toLines(surface.domains)
  if (domains.length) lines.push(`- 关注领域：${domains.join('、')}`)
  const stances = toLines(surface.stances)
  if (stances.length) lines.push(`- 观点立场：${stances.join('；')}`)
  const scenes = toLines(surface.scenes)
  if (scenes.length) lines.push(`- 记录场景：${scenes.join('、')}`)

  const feedback = card.feedback || {}
  const deepGroups = [
    ['思维模式', card.deep?.thinkingPatterns],
    ['决策偏好', card.deep?.decisionPreferences],
    ['情绪模式', card.deep?.emotionalPatterns],
    ['未完成的人生主题', card.deep?.unfinishedLifeThemes],
  ]
  for (const [label, insights] of deepGroups) {
    const accepted = (Array.isArray(insights) ? insights : [])
      .filter((item) => {
        const rawStatus = feedback[item.id]
        const status =
          typeof rawStatus === 'string' ? rawStatus : rawStatus?.status
        return item.confidence !== 'low' && status !== 'rejected' && status !== 'hidden'
      })
      .map((item) => item.insight)
      .filter(Boolean)
    if (accepted.length) lines.push(`- ${label}（可修正假设）：${accepted.join('；')}`)
  }
  if (!lines.length) return ''

  return `用户数字人格（依据历史记录归纳，仅作为可修正假设）：
${lines.join('\n')}`
}

// ---------- 主流程 ----------

async function prepareCheckpoint(activeCount, { force = false } = {}) {
  const existing = force ? null : await loadCheckpoint()
  if (existing?.batches?.length) {
    const createdTime = new Date(String(existing.createdAt || '').replace(' ', 'T')).getTime()
    const fresh = !Number.isNaN(createdTime) && Date.now() - createdTime < CHECKPOINT_MAX_AGE_MS
    if (fresh && existing.nextBatchIndex <= existing.batches.length) {
      return existing
    }
  }

  const [fragments, excerpts] = await Promise.all([
    sampleFragments(),
    sampleStructNoteExcerpts(),
  ])
  const samples = [...fragments, ...excerpts]
  if (!samples.length) return null
  const structNotes = new Set(
    excerpts.map((sample) => sample.sourceId).filter(Boolean),
  ).size

  const checkpoint = {
    schemaVersion: 2,
    createdAt: formatDateTime(),
    source: {
      analyzedCount: activeCount,
      fragmentSamples: fragments.length,
      structNotes,
    },
    batches: packIntoBatches(samples),
    nextBatchIndex: 0,
    mapResults: [],
  }
  await saveCheckpoint(checkpoint)
  return checkpoint
}

async function runMapPhase(checkpoint) {
  const { batches } = checkpoint
  const totalSamples = batches.reduce((sum, batch) => sum + batch.length, 0)
  for (let i = checkpoint.nextBatchIndex; i < batches.length; i += 1) {
    const processedBefore = batches
      .slice(0, i)
      .reduce((sum, batch) => sum + batch.length, 0)
    updateProgress({
      stage: 'analyzing',
      message: `正在分析第 ${i + 1}/${batches.length} 批记录`,
      percent: 10 + Math.round((i / batches.length) * 70),
      processedBatches: i,
      totalBatches: batches.length,
      processedSamples: processedBefore,
      totalSamples,
    })
    const content = await requestAnalysis(MAP_SYSTEM_PROMPT, buildMapUserContent(batches[i]))
    const parsed = parseJsonFromContent(content)
    const validKeys = new Set(batches[i].map((sample) => sample.sampleKey))
    checkpoint.mapResults.push({
      style: toLines(parsed?.style),
      surface: normalizeSurface(parsed?.surface),
      findings: (Array.isArray(parsed?.findings) ? parsed.findings : [])
        .map((item) => normalizeMapFinding(item, validKeys))
        .filter(Boolean),
    })
    checkpoint.nextBatchIndex = i + 1
    await saveCheckpoint(checkpoint)
    updateProgress({
      processedBatches: i + 1,
      processedSamples: processedBefore + batches[i].length,
      percent: 10 + Math.round(((i + 1) / batches.length) * 70),
    })
  }
  return checkpoint
}

async function reduceCard(systemPrompt, findings) {
  if (!findings.length) return null
  const user = typeof findings[0] === 'string'
    ? findings.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : JSON.stringify(findings)
  const content = await requestAnalysis(systemPrompt, user)
  return parseJsonFromContent(content)
}

function isAiConfigured(settings) {
  if (settings.provider === 'utools') return isUtoolsAiAvailable()
  return isThirdPartyConfigured(settings)
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
    updateProgress({
      stage: 'sampling',
      message: '正在读取并分层采样碎片与沉淀',
      percent: 5,
      processedBatches: 0,
      totalBatches: 0,
      processedSamples: 0,
      totalSamples: 0,
      fragmentSamples: 0,
      structNotes: 0,
    })
    try {
      const activeCount = await countActiveFragments()
      const checkpoint = await prepareCheckpoint(activeCount, { force })
      if (!checkpoint) {
        updateProgress({
          stage: 'complete',
          message: '没有找到可分析的记录',
          percent: 100,
        })
        return { ok: false, reason: 'no-samples' }
      }

      const allCheckpointSamples = checkpoint.batches.flat()
      const fragmentSamples =
        checkpoint.source?.fragmentSamples ??
        allCheckpointSamples.filter((sample) => sample.sourceType === 'fragment').length
      const structNotes =
        checkpoint.source?.structNotes ??
        new Set(
          allCheckpointSamples
            .filter((sample) => sample.sourceType === 'structNote')
            .map((sample) => sample.sourceId),
        ).size
      updateProgress({
        message: `已选取 ${fragmentSamples} 条碎片、${structNotes} 篇沉淀`,
        percent: 10,
        totalBatches: checkpoint.batches.length,
        totalSamples: allCheckpointSamples.length,
        fragmentSamples,
        structNotes,
      })

      await runMapPhase(checkpoint)

      const styleFindings = checkpoint.mapResults.flatMap((item) => item.style)
      const personaFindings = {
        surfaces: checkpoint.mapResults.map((item) => item.surface),
        findings: checkpoint.mapResults.flatMap((item) => item.findings),
      }
      const allSamples = checkpoint.batches.flat()
      const source = {
        analyzedCount: checkpoint.source?.analyzedCount ?? activeCount,
        sampleCount: checkpoint.batches.reduce((sum, batch) => sum + batch.length, 0),
      }

      const [existingStyle, existingPersona] = await Promise.all([
        loadProfile(PROFILE_TYPES.writingStyle),
        loadProfile(PROFILE_TYPES.persona),
      ])
      personaFindings.feedbackConstraints = Object.entries(
        existingPersona?.card?.feedback || {},
      ).map(([id, value]) => ({
        id,
        status: typeof value === 'string' ? value : value?.status,
        insight: typeof value === 'object' ? value?.insight || '' : '',
      }))

      if (!existingStyle?.manualLocked) {
        updateProgress({
          stage: 'reducing-style',
          message: '正在合并写作风格特征',
          percent: 84,
        })
        const card = await reduceCard(REDUCE_STYLE_SYSTEM_PROMPT, styleFindings)
        const promptText = buildStylePromptText(card)
        if (card && promptText) {
          await saveProfile(PROFILE_TYPES.writingStyle, { card, promptText, source })
        }
      }

      let personaSaved = false
      if (!existingPersona?.manualLocked) {
        updateProgress({
          stage: 'reducing-persona',
          message: '正在合并人格洞察、证据与反证',
          percent: 92,
        })

        // 深层洞察以 Map 证据为准本地合并，避免 Reduce 弄丢 sampleKey 导致整卡空白
        const localDeep = buildDeepFromMapFindings(
          personaFindings.findings,
          allSamples,
          existingPersona?.card,
        )
        const localSurface = mergeSurfaceLists(personaFindings.surfaces)

        let reduced = null
        try {
          reduced = await reduceCard(REDUCE_PERSONA_SYSTEM_PROMPT, [personaFindings])
        } catch (error) {
          console.warn('[烂笔头] 人格 Reduce 失败，将使用本地合并结果', error)
        }

        const reducedCard = normalizePersonaCard(reduced, allSamples, existingPersona?.card)
        const card = {
          summary: reducedCard.summary || existingPersona?.card?.summary || '',
          surface: hasSurfaceContent(reducedCard.surface) ? reducedCard.surface : localSurface,
          deep: hasDeepContent(reducedCard.deep) ? reducedCard.deep : localDeep,
          feedback: existingPersona?.card?.feedback || {},
          manualOverride: existingPersona?.card?.manualOverride || '',
        }

        // Reduce 有摘要但深层被弄丢时，回填本地深层
        if (!hasDeepContent(card.deep) && hasDeepContent(localDeep)) {
          card.deep = localDeep
        }
        if (!hasSurfaceContent(card.surface) && hasSurfaceContent(localSurface)) {
          card.surface = localSurface
        }

        const promptText = buildPersonaPromptText(card)
        if (hasPersonaContent(card)) {
          await saveProfile(PROFILE_TYPES.persona, {
            schemaVersion: PROFILE_SCHEMA_VERSION,
            needsReanalysis: false,
            manualLocked: false,
            card,
            promptText:
              promptText ||
              `用户数字人格（依据历史记录归纳，仅作为可修正假设）：\n- 概括：${card.summary || '已生成，请在设置页查看详情'}`,
            source: {
              ...source,
              findingCount: personaFindings.findings.length,
              deepInsightCount: Object.values(card.deep || {}).reduce(
                (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
                0,
              ),
            },
          })
          personaSaved = true
        } else {
          console.warn('[烂笔头] 人格分析结果为空，未写入', {
            findingCount: personaFindings.findings.length,
            reduced: Boolean(reduced),
          })
        }
      }

      await clearCheckpoint()
      profileRevision.value += 1
      updateProgress({
        stage: personaSaved || existingPersona?.manualLocked ? 'complete' : 'error',
        message: personaSaved
          ? `分析完成：${fragmentSamples} 条碎片、${structNotes} 篇沉淀`
          : existingPersona?.manualLocked
            ? '分析完成，但画像已锁定，未覆盖'
            : '分析完成，但未提取到可落库的画像（可能证据不足）',
        percent: 100,
        processedBatches: checkpoint.batches.length,
        processedSamples: allCheckpointSamples.length,
      })
      return { ok: true, analyzedCount: source.analyzedCount, personaSaved }
    } catch (error) {
      updateProgress({
        stage: 'error',
        message: error instanceof Error ? error.message : '分析失败',
      })
      throw error
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

/** 惰性后台触发：受「自动分析画像」开关控制，失败只告警 */
export function maybeRunProfileAnalysis() {
  if (typeof window === 'undefined' || !window.utools?.db) return
  if (!isAutoProfileAnalysisEnabled()) return
  runProfileAnalysis({ force: false }).catch((error) => {
    console.warn('[烂笔头] 画像后台分析失败，将在下次触发时重试', error)
  })
}
