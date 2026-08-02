const STORAGE_KEY = 'lanbitou/sediment-templates'
const VERSION_KEY = 'lanbitou/sediment-templates-version'
const TEMPLATE_SEED_VERSION = 4

const LEGACY_TODOS_MERGE_LINE = '3. 合并重复或相近的待办；无法判断完成状态时默认为未完成'

const DEFAULT_MIMIC_WRITING_STYLE = true
const DEFAULT_HUMANIZE_DRAFT = true

/** 仅保留最常用、输出形态差异明显的内置模板；其余由用户自定义 */
export const BUILTIN_TEMPLATE_SEED = [
  {
    id: 'compose',
    title: '整理成文',
    instruction: `将碎片整合为一篇连贯、可直接阅读的长文。

输出格式（严格遵守）：
1. 按逻辑分 2-4 段，段间空一行；可用 ## 小标题划分主题，不要使用一级标题 #
2. 用完整句子与过渡语串联，不要罗列碎片编号
3. 保留有价值细节，合并重复表述
4. 信息不足处不编造，可略去无法支撑的结论`,
    mimicWritingStyle: true,
    humanizeDraft: true,
  },
  {
    id: 'summarize',
    title: '提炼要点',
    instruction: `将碎片提炼为精简的结构化要点。

输出格式（严格遵守）：
1. 使用 - 无序列表呈现，每条一句、信息完整
2. 可先用一句简短总起（非标题），再列要点
3. 合并重复项，去掉套话；按重要程度排列
4. 无明确结论时不强行归纳`,
    mimicWritingStyle: true,
    humanizeDraft: false,
  },
  {
    id: 'todos',
    title: '整理成待办',
    instruction: `将碎片中的行动项、计划与跟进事项整理为 Markdown 待办清单。

输出格式（严格遵守）：
1. 可用 ## 小节标题分组（如「本周」「待跟进」「已完成」），不要使用一级标题 #
2. 每条待办使用 - [ ] 未完成 或 - [x] 已完成 语法
3. 保留全部行动项，仅合并表述完全相同的待办；无法判断完成状态时默认为未完成
4. 可在待办后用括号补充简短背景、负责人或截止日期
5. 非行动类信息整理为简短列表或段落，放在对应分组末尾`,
    mimicWritingStyle: true,
    humanizeDraft: false,
  },
]

/** 迁移用：旧版内置提示词（仅用于识别未自定义过的条目并升级） */
const LEGACY_BUILTIN_INSTRUCTIONS = {
  summarize: '将以下碎片提炼为结构化要点列表，保留关键信息，去除重复内容。',
  compose: '将以下碎片整合为一篇连贯的长文，逻辑清晰、段落分明，保留有价值的细节。',
  timeline: '按时间顺序整理以下碎片，标注时间节点，梳理事件发展脉络。',
  compare: '分析以下碎片中的不同观点或对立面，整理成对比结构，突出异同。',
}

/** 历史模板 id → 显示名（已引入碎片的标注回退，不要求仍存在于模板列表） */
export const LEGACY_BUILTIN_LABELS = {
  summarize: '提炼要点',
  compose: '整理成文',
  timeline: '按时间线',
  compare: '正反对比',
  todos: '整理成待办',
}

const listeners = new Set()

function notify() {
  listeners.forEach((callback) => callback())
}

function getStorage() {
  if (typeof window === 'undefined') return null
  if (window.utools?.dbStorage) return window.utools.dbStorage
  try {
    return {
      getItem: (key) => {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      },
      setItem: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value))
      },
    }
  } catch {
    return null
  }
}

function normalizeBool(value, fallback) {
  if (value === undefined || value === null) return fallback
  return value === true
}

function normalizeTemplate(item) {
  if (!item || typeof item.id !== 'string') return null
  const title = String(item.title || '').trim()
  const instruction = String(item.instruction || '').trim()
  if (!title || !instruction) return null
  return {
    id: item.id,
    title,
    instruction,
    mimicWritingStyle: normalizeBool(item.mimicWritingStyle, DEFAULT_MIMIC_WRITING_STYLE),
    humanizeDraft: normalizeBool(item.humanizeDraft, DEFAULT_HUMANIZE_DRAFT),
  }
}

export function getDefaultSedimentTemplates() {
  return BUILTIN_TEMPLATE_SEED.map((item) => normalizeTemplate({ ...item }))
}

export function subscribeSedimentTemplates(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function applyTemplateMigrations(list, storage) {
  const version = Number(storage.getItem(VERSION_KEY)) || 1
  if (version >= TEMPLATE_SEED_VERSION) {
    return list.map(normalizeTemplate).filter(Boolean)
  }

  let next = list.map((item) => {
    const seed = BUILTIN_TEMPLATE_SEED.find((entry) => entry.id === item?.id)
    if (!seed) return item

    const legacy = LEGACY_BUILTIN_INSTRUCTIONS[item.id]
    if (legacy && item.instruction === legacy) {
      return {
        ...item,
        title: seed.title,
        instruction: seed.instruction,
        mimicWritingStyle: seed.mimicWritingStyle,
        humanizeDraft: seed.humanizeDraft,
      }
    }
    return item
  })

  if (version < 3) {
    const todosSeed = BUILTIN_TEMPLATE_SEED.find((entry) => entry.id === 'todos')
    next = next.map((item) => {
      if (item?.id !== 'todos' || !todosSeed) return item
      if (!String(item.instruction || '').includes(LEGACY_TODOS_MERGE_LINE)) return item
      return { ...item, instruction: todosSeed.instruction }
    })
  }

  if (version < 4) {
    next = next.map((item) => {
      if (!item || typeof item !== 'object') return item
      const seed = BUILTIN_TEMPLATE_SEED.find((entry) => entry.id === item.id)
      const hasMimic = Object.prototype.hasOwnProperty.call(item, 'mimicWritingStyle')
      const hasHumanize = Object.prototype.hasOwnProperty.call(item, 'humanizeDraft')
      if (hasMimic && hasHumanize) return item
      return {
        ...item,
        mimicWritingStyle: hasMimic
          ? item.mimicWritingStyle === true
          : (seed?.mimicWritingStyle ?? DEFAULT_MIMIC_WRITING_STYLE),
        humanizeDraft: hasHumanize
          ? item.humanizeDraft === true
          : (seed?.humanizeDraft ?? DEFAULT_HUMANIZE_DRAFT),
      }
    })
  }

  const normalized = next.map(normalizeTemplate).filter(Boolean)
  storage.setItem(VERSION_KEY, TEMPLATE_SEED_VERSION)
  storage.setItem(STORAGE_KEY, normalized)
  return normalized
}

export function loadSedimentTemplates() {
  const storage = getStorage()
  if (!storage) return getDefaultSedimentTemplates()

  const saved = storage.getItem(STORAGE_KEY)
  if (!Array.isArray(saved) || !saved.length) {
    const defaults = getDefaultSedimentTemplates()
    storage.setItem(STORAGE_KEY, defaults)
    storage.setItem(VERSION_KEY, TEMPLATE_SEED_VERSION)
    return defaults
  }

  return applyTemplateMigrations(saved, storage)
}

export function saveSedimentTemplates(list) {
  const storage = getStorage()
  if (!storage) throw new Error('存储不可用')

  const next = (Array.isArray(list) ? list : [])
    .map(normalizeTemplate)
    .filter(Boolean)

  storage.setItem(STORAGE_KEY, next)
  notify()
}

export function getSedimentTemplateById(id) {
  const key = String(id ?? '').trim()
  if (!key) return null
  return loadSedimentTemplates().find((item) => item.id === key) || null
}

export function getSedimentTemplateTitle(id) {
  const key = String(id ?? '').trim()
  if (!key) return ''
  return getSedimentTemplateById(key)?.title || LEGACY_BUILTIN_LABELS[key] || ''
}

export function getSedimentTemplateInstruction(id) {
  const key = String(id ?? '').trim()
  const composeFallback = BUILTIN_TEMPLATE_SEED.find((item) => item.id === 'compose')?.instruction || ''
  if (!key) return composeFallback

  return getSedimentTemplateById(key)?.instruction
    || BUILTIN_TEMPLATE_SEED.find((item) => item.id === key)?.instruction
    || LEGACY_BUILTIN_INSTRUCTIONS[key]
    || composeFallback
}

/** 整理草稿时按模板解析行为开关（仅当前模板生效） */
export function resolveSedimentTemplateDraftOptions(preset) {
  const key = String(preset ?? '').trim()
  const template = key ? getSedimentTemplateById(key) : null
  const seed = key ? BUILTIN_TEMPLATE_SEED.find((item) => item.id === key) : null
  const source = template || seed || BUILTIN_TEMPLATE_SEED.find((item) => item.id === 'compose')
  return {
    mimicWritingStyle: normalizeBool(source?.mimicWritingStyle, DEFAULT_MIMIC_WRITING_STYLE),
    humanizeDraft: normalizeBool(source?.humanizeDraft, DEFAULT_HUMANIZE_DRAFT),
  }
}

export function createSedimentTemplate({
  title,
  instruction,
  mimicWritingStyle = DEFAULT_MIMIC_WRITING_STYLE,
  humanizeDraft = DEFAULT_HUMANIZE_DRAFT,
} = {}) {
  const item = normalizeTemplate({
    id: `tpl_${Date.now()}`,
    title,
    instruction,
    mimicWritingStyle,
    humanizeDraft,
  })
  if (!item) throw new Error('标题和提示词不能为空')

  const list = loadSedimentTemplates()
  saveSedimentTemplates([item, ...list])
  return item
}

export function updateSedimentTemplate(id, {
  title,
  instruction,
  mimicWritingStyle,
  humanizeDraft,
} = {}) {
  const key = String(id ?? '').trim()
  const list = loadSedimentTemplates()
  const index = list.findIndex((item) => item.id === key)
  if (index < 0) throw new Error('模板不存在')

  const prev = list[index]
  const next = normalizeTemplate({
    id: key,
    title: title ?? prev.title,
    instruction: instruction ?? prev.instruction,
    mimicWritingStyle:
      mimicWritingStyle === undefined ? prev.mimicWritingStyle : mimicWritingStyle,
    humanizeDraft:
      humanizeDraft === undefined ? prev.humanizeDraft : humanizeDraft,
  })
  if (!next) throw new Error('标题和提示词不能为空')

  const updated = [...list]
  updated[index] = next
  saveSedimentTemplates(updated)
  return next
}

export function deleteSedimentTemplate(id) {
  const key = String(id ?? '').trim()
  saveSedimentTemplates(loadSedimentTemplates().filter((item) => item.id !== key))
}
