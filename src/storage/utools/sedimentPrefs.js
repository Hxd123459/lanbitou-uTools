const PREFS_KEY = 'lanbitou/sediment-prefs'

/** 整理成文保存后，是否从碎片列表归档移除（默认开，保持历史行为） */
const DEFAULT_PREFS = {
  archiveFragmentsAfterSediment: true,
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

export function loadSedimentPrefs() {
  const storage = getStorage()
  if (!storage) return { ...DEFAULT_PREFS }

  const saved = storage.getItem(PREFS_KEY)
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_PREFS }

  return {
    archiveFragmentsAfterSediment:
      saved.archiveFragmentsAfterSediment === undefined
        ? DEFAULT_PREFS.archiveFragmentsAfterSediment
        : saved.archiveFragmentsAfterSediment === true,
  }
}

export function saveSedimentPrefs(patch = {}) {
  const storage = getStorage()
  if (!storage) throw new Error('存储不可用')

  const prev = loadSedimentPrefs()
  const next = {
    archiveFragmentsAfterSediment:
      patch.archiveFragmentsAfterSediment === undefined
        ? prev.archiveFragmentsAfterSediment
        : patch.archiveFragmentsAfterSediment === true,
  }
  storage.setItem(PREFS_KEY, next)
  return next
}

export function isArchiveFragmentsAfterSedimentEnabled() {
  return loadSedimentPrefs().archiveFragmentsAfterSediment === true
}

export function saveArchiveFragmentsAfterSediment(enabled) {
  return saveSedimentPrefs({ archiveFragmentsAfterSediment: enabled === true })
}
