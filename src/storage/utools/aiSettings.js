const SETTINGS_KEY = 'lanbitou/ai-settings'
const API_KEY_KEY = 'lanbitou/ai-api-key'

export const AI_PROVIDERS = {
  utools: { id: 'utools', label: 'uTools AI', defaultModel: '', defaultBaseUrl: '' },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-3-5-haiku-latest',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
}

const DEFAULT_SETTINGS = {
  provider: 'utools',
  model: '',
  autoTagEnabled: false,
}

function getStorage() {
  if (typeof window === 'undefined' || !window.utools?.dbStorage) return null
  return window.utools.dbStorage
}

function getCryptoStorage() {
  if (typeof window === 'undefined' || !window.utools?.dbCryptoStorage) return null
  return window.utools.dbCryptoStorage
}

export function loadAiSettings() {
  const storage = getStorage()
  if (!storage) return { ...DEFAULT_SETTINGS, apiKey: '', baseUrl: '' }

  const saved = storage.getItem(SETTINGS_KEY)
  const provider = saved?.provider && AI_PROVIDERS[saved.provider]
    ? saved.provider
    : DEFAULT_SETTINGS.provider

  const model =
    typeof saved?.model === 'string'
      ? saved.model
      : AI_PROVIDERS[provider]?.defaultModel || ''

  const baseUrl =
    typeof saved?.baseUrl === 'string'
      ? saved.baseUrl
      : AI_PROVIDERS[provider]?.defaultBaseUrl || ''

  const crypto = getCryptoStorage()
  const apiKey = crypto?.getItem(API_KEY_KEY) || ''

  const autoTagEnabled = saved?.autoTagEnabled === true

  return { provider, model, baseUrl, apiKey, autoTagEnabled }
}

export function saveAiSettings({ provider, model, baseUrl, apiKey, autoTagEnabled }) {
  const storage = getStorage()
  const crypto = getCryptoStorage()
  if (!storage) throw new Error('uTools 存储不可用')

  const prev = storage.getItem(SETTINGS_KEY) || {}
  const nextProvider =
    provider !== undefined
      ? AI_PROVIDERS[provider]
        ? provider
        : 'utools'
      : prev.provider && AI_PROVIDERS[prev.provider]
        ? prev.provider
        : DEFAULT_SETTINGS.provider

  storage.setItem(SETTINGS_KEY, {
    ...prev,
    provider: nextProvider,
    model:
      model !== undefined
        ? String(model ?? '').trim()
        : String(prev.model ?? AI_PROVIDERS[nextProvider]?.defaultModel ?? ''),
    baseUrl:
      baseUrl !== undefined
        ? String(baseUrl ?? '').trim()
        : String(prev.baseUrl ?? AI_PROVIDERS[nextProvider]?.defaultBaseUrl ?? ''),
    autoTagEnabled:
      autoTagEnabled === undefined ? prev.autoTagEnabled === true : autoTagEnabled === true,
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

export function getResolvedModel(settings) {
  const provider = settings?.provider || 'utools'
  const model = String(settings?.model || '').trim()
  if (model) return model
  return AI_PROVIDERS[provider]?.defaultModel || ''
}

export function getResolvedBaseUrl(settings) {
  const provider = settings?.provider || 'utools'
  const baseUrl = String(settings?.baseUrl || '').trim()
  if (baseUrl) return baseUrl.replace(/\/+$/, '')
  return AI_PROVIDERS[provider]?.defaultBaseUrl || ''
}
