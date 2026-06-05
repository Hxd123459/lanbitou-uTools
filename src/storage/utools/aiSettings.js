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

  return { provider, model, baseUrl, apiKey }
}

export function saveAiSettings({ provider, model, baseUrl, apiKey }) {
  const storage = getStorage()
  const crypto = getCryptoStorage()
  if (!storage) throw new Error('uTools 存储不可用')

  const nextProvider = AI_PROVIDERS[provider] ? provider : 'utools'
  storage.setItem(SETTINGS_KEY, {
    provider: nextProvider,
    model: String(model ?? '').trim(),
    baseUrl: String(baseUrl ?? '').trim(),
  })

  if (crypto && apiKey !== undefined) {
    const trimmed = String(apiKey ?? '').trim()
    if (trimmed) crypto.setItem(API_KEY_KEY, trimmed)
    else crypto.removeItem(API_KEY_KEY)
  }
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
