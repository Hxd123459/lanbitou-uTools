const SETTINGS_KEY = 'lanbitou/ai-settings'
const API_KEY_KEY = 'lanbitou/ai-api-key'

export const AI_PROTOCOL = {
  utools: 'utools',
  openai: 'openai',
  anthropic: 'anthropic',
}

export const AI_PROVIDERS = {
  utools: {
    id: 'utools',
    label: 'uTools AI',
    protocol: AI_PROTOCOL.utools,
    defaultModel: '',
    defaultBaseUrl: '',
    hint: '使用 uTools 平台额度，无需填写 Key',
  },
  zhipu: {
    id: 'zhipu',
    label: '智谱 GLM',
    protocol: AI_PROTOCOL.openai,
    defaultModel: 'glm-5.2',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-5.2', label: 'GLM-5.2' },
      { id: 'glm-5.3', label: 'GLM-5.3' },
      { id: 'glm-5.3-flash', label: 'GLM-5.3 Flash' },
    ],
    keyPlaceholder: '在智谱开放平台复制 API Key',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: AI_PROTOCOL.openai,
    defaultModel: 'deepseek-v4-flash',
    defaultBaseUrl: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    ],
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  qwen: {
    id: 'qwen',
    label: '通义千问',
    protocol: AI_PROTOCOL.openai,
    defaultModel: 'qwen-plus',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-plus', label: '千问 Plus' },
      { id: 'qwen-max', label: '千问 Max' },
      { id: 'qwen-turbo', label: '千问 Turbo' },
    ],
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://bailian.console.aliyun.com/',
  },
  moonshot: {
    id: 'moonshot',
    label: 'Kimi',
    protocol: AI_PROTOCOL.openai,
    defaultModel: 'kimi-k3',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    models: [
      { id: 'kimi-k3', label: 'Kimi K3' },
      { id: 'kimi-k2.6', label: 'Kimi K2.6' },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code' },
    ],
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    protocol: AI_PROTOCOL.openai,
    defaultModel: 'gpt-5.6-luna',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { id: 'gpt-5.6', label: 'GPT-5.6' },
    ],
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    protocol: AI_PROTOCOL.anthropic,
    defaultModel: 'claude-haiku-4-5',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
    ],
    keyPlaceholder: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  custom: {
    id: 'custom',
    label: '自定义',
    protocol: AI_PROTOCOL.openai,
    defaultModel: '',
    defaultBaseUrl: '',
    requiresBaseUrl: true,
    keyPlaceholder: 'sk-...',
    hint: '硅基流动、中转站等 OpenAI 兼容接口',
  },
}

export const AI_PROVIDER_ORDER = [
  'utools',
  'zhipu',
  'deepseek',
  'qwen',
  'moonshot',
  'openai',
  'anthropic',
  'custom',
]

const DEFAULT_SETTINGS = {
  provider: 'utools',
  model: '',
  autoTagEnabled: false,
  /** 测试阶段默认关闭，避免启动/记笔记时悄悄烧 token */
  autoProfileAnalysis: false,
}

function getStorage() {
  if (typeof window === 'undefined' || !window.utools?.dbStorage) return null
  return window.utools.dbStorage
}

function getCryptoStorage() {
  if (typeof window === 'undefined' || !window.utools?.dbCryptoStorage) return null
  return window.utools.dbCryptoStorage
}

const MODEL_ALIASES = {
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
}

export function listAiProviders() {
  return AI_PROVIDER_ORDER.map((id) => AI_PROVIDERS[id]).filter(Boolean)
}

export function getProviderModelOptions(provider) {
  return (AI_PROVIDERS[provider]?.models || []).map((item) =>
    typeof item === 'string' ? { id: item, label: item } : item,
  )
}

export function getProviderModelIds(provider) {
  return getProviderModelOptions(provider).map((item) => item.id)
}

export function normalizeModelId(provider, model) {
  const raw = String(model || '').trim()
  const aliased = MODEL_ALIASES[raw] || raw
  if (aliased) return aliased
  return AI_PROVIDERS[provider]?.defaultModel || ''
}

export function getAiProtocol(provider) {
  return AI_PROVIDERS[provider]?.protocol || AI_PROTOCOL.utools
}

export function isUtoolsProvider(provider) {
  return getAiProtocol(provider) === AI_PROTOCOL.utools
}

export function isOpenAiCompatible(provider) {
  return getAiProtocol(provider) === AI_PROTOCOL.openai
}

export function isAnthropicProvider(provider) {
  return getAiProtocol(provider) === AI_PROTOCOL.anthropic
}

export function isThirdPartyProvider(provider) {
  const protocol = getAiProtocol(provider)
  return protocol === AI_PROTOCOL.openai || protocol === AI_PROTOCOL.anthropic
}

function hostOf(url) {
  return String(url || '').trim().toLowerCase()
}

/** 把旧版「OpenAI + 自填地址」识别成对应运营商 */
export function normalizeProviderId(provider, baseUrl) {
  if (provider && AI_PROVIDERS[provider] && provider !== 'openai' && provider !== 'custom') {
    return provider
  }

  const url = hostOf(baseUrl)
  if (url.includes('bigmodel.cn')) return 'zhipu'
  if (url.includes('deepseek.com')) return 'deepseek'
  if (url.includes('dashscope.aliyuncs.com') || url.includes('aliyuncs.com')) return 'qwen'
  if (url.includes('moonshot.cn')) return 'moonshot'
  if (url.includes('anthropic.com')) return 'anthropic'

  if (provider === 'anthropic') return 'anthropic'
  if (provider === 'utools') return 'utools'
  if (provider === 'custom') return 'custom'

  if (provider === 'openai') {
    if (!url || url.includes('api.openai.com')) return 'openai'
    return 'custom'
  }

  return provider && AI_PROVIDERS[provider] ? provider : DEFAULT_SETTINGS.provider
}

export function getResolvedModel(settings) {
  const provider = normalizeProviderId(settings?.provider, settings?.baseUrl)
  return normalizeModelId(provider, settings?.model)
}

export function getResolvedBaseUrl(settings) {
  const provider = normalizeProviderId(settings?.provider, settings?.baseUrl)
  const baseUrl = String(settings?.baseUrl || '').trim()
  if (baseUrl) return baseUrl.replace(/\/+$/, '')
  return String(AI_PROVIDERS[provider]?.defaultBaseUrl || '').replace(/\/+$/, '')
}

export function isThirdPartyConfigured(settings) {
  const provider = normalizeProviderId(settings?.provider, settings?.baseUrl)
  if (!isThirdPartyProvider(provider)) return false
  if (!String(settings?.apiKey ?? '').trim()) return false
  return Boolean(getResolvedBaseUrl({ ...settings, provider }))
}

export function applyProviderRequestExtras(provider, model, body) {
  const extras = AI_PROVIDERS[provider]?.requestExtras
  const next = extras ? { ...body, ...extras } : { ...body }
  const name = String(model || '').toLowerCase()
  if (provider === 'zhipu' && /^glm-5\.2/.test(name)) {
    next.thinking = { type: 'disabled' }
  }
  return next
}

function persistBaseUrl(provider, baseUrl) {
  const trimmed = String(baseUrl ?? '').trim().replace(/\/+$/, '')
  if (trimmed) return trimmed
  if (AI_PROVIDERS[provider]?.requiresBaseUrl) return ''
  return String(AI_PROVIDERS[provider]?.defaultBaseUrl || '').replace(/\/+$/, '')
}

function persistModel(provider, model) {
  return normalizeModelId(provider, model)
}

export function loadAiSettings() {
  const storage = getStorage()
  if (!storage) return { ...DEFAULT_SETTINGS, apiKey: '', baseUrl: '' }

  const saved = storage.getItem(SETTINGS_KEY)
  const provider = normalizeProviderId(saved?.provider, saved?.baseUrl)

  const model =
    typeof saved?.model === 'string'
      ? normalizeModelId(provider, saved.model)
      : AI_PROVIDERS[provider]?.defaultModel || ''

  const baseUrl =
    typeof saved?.baseUrl === 'string' && saved.baseUrl.trim()
      ? saved.baseUrl
      : AI_PROVIDERS[provider]?.defaultBaseUrl || ''

  const crypto = getCryptoStorage()
  const apiKey = crypto?.getItem(API_KEY_KEY) || ''

  const autoTagEnabled = saved?.autoTagEnabled === true
  const autoProfileAnalysis =
    saved?.autoProfileAnalysis === undefined
      ? DEFAULT_SETTINGS.autoProfileAnalysis
      : saved.autoProfileAnalysis === true

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    autoTagEnabled,
    autoProfileAnalysis,
  }
}

export function saveAiSettings({
  provider,
  model,
  baseUrl,
  apiKey,
  autoTagEnabled,
  autoProfileAnalysis,
}) {
  const storage = getStorage()
  const crypto = getCryptoStorage()
  if (!storage) throw new Error('uTools 存储不可用')

  const prev = storage.getItem(SETTINGS_KEY) || {}
  const nextProvider =
    provider !== undefined
      ? normalizeProviderId(provider, baseUrl ?? prev.baseUrl)
      : normalizeProviderId(prev.provider, prev.baseUrl)

  storage.setItem(SETTINGS_KEY, {
    ...prev,
    provider: nextProvider,
    model:
      model !== undefined
        ? persistModel(nextProvider, model)
        : persistModel(nextProvider, prev.model),
    baseUrl:
      baseUrl !== undefined
        ? persistBaseUrl(nextProvider, baseUrl)
        : persistBaseUrl(nextProvider, prev.baseUrl),
    autoTagEnabled:
      autoTagEnabled === undefined ? prev.autoTagEnabled === true : autoTagEnabled === true,
    autoProfileAnalysis:
      autoProfileAnalysis === undefined
        ? prev.autoProfileAnalysis === true
        : autoProfileAnalysis === true,
  })

  if (crypto && apiKey !== undefined) {
    const trimmed = String(apiKey ?? '').trim()
    if (trimmed) crypto.setItem(API_KEY_KEY, trimmed)
    else crypto.removeItem(API_KEY_KEY)
  }
}

export function saveAutoTagEnabled(enabled) {
  saveAiSettings({ autoTagEnabled: enabled === true })
}

export function saveAutoProfileAnalysis(enabled) {
  saveAiSettings({ autoProfileAnalysis: enabled === true })
}

export function isAutoProfileAnalysisEnabled() {
  return loadAiSettings().autoProfileAnalysis === true
}

/** 开启自动打标时一并持久化服务来源，供记录笔记时 generateNoteTitle 读取 */
export function saveProviderAndAutoTagEnabled({ provider, model, baseUrl, apiKey }) {
  saveAiSettings({
    provider,
    model,
    baseUrl,
    apiKey,
    autoTagEnabled: true,
  })
}
