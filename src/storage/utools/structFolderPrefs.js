const PREFS_KEY = 'lanbitou/struct-folder-prefs'

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

export function loadStructFolderPrefs() {
  const storage = getStorage()
  if (!storage) return { lastParentId: 0, lastPathStack: [] }

  const saved = storage.getItem(PREFS_KEY)
  const lastParentId = Number(saved?.lastParentId) || 0
  const lastPathStack = Array.isArray(saved?.lastPathStack)
    ? saved.lastPathStack
        .filter((item) => item && item.id != null)
        .map((item) => ({
          id: item.id,
          name: String(item.name || '未命名'),
        }))
    : []

  return { lastParentId, lastPathStack }
}

export function saveStructFolderPrefs({ parentId, pathStack }) {
  const storage = getStorage()
  if (!storage) return

  const stack = Array.isArray(pathStack)
    ? pathStack.map((item) => ({
        id: item.id,
        name: String(item.name || '未命名'),
      }))
    : []

  storage.setItem(PREFS_KEY, {
    lastParentId: Number(parentId) || 0,
    lastPathStack: stack,
  })
}
