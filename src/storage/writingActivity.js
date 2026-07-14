import { ref } from 'vue'

export const WRITING_ACTIVITY_KEY = 'lanbitou/writing-activity'
/** 写入账本变更时递增，供统计面板即时刷新 */
export const writingActivityRevision = ref(0)

function toLocalDateKey(dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateKeyFromNoteTime(value) {
  if (!value) return null
  const raw = String(value)
  const sliced = raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : toLocalDateKey(value)
}

export function countWritingChars(text) {
  return String(text ?? '').replace(/\s/g, '').length
}

function readStorage() {
  try {
    if (typeof window !== 'undefined' && window.utools?.dbStorage) {
      const saved = window.utools.dbStorage.getItem(WRITING_ACTIVITY_KEY)
      if (saved && typeof saved === 'object') return saved
    }
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem(WRITING_ACTIVITY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return null
}

function writeStorage(data) {
  try {
    if (typeof window !== 'undefined' && window.utools?.dbStorage) {
      window.utools.dbStorage.setItem(WRITING_ACTIVITY_KEY, data)
      writingActivityRevision.value += 1
      return
    }
  } catch {
    // fall through
  }
  try {
    localStorage.setItem(WRITING_ACTIVITY_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
  writingActivityRevision.value += 1
}

function normalize(data) {
  const wordsByDate =
    data?.wordsByDate && typeof data.wordsByDate === 'object' && !Array.isArray(data.wordsByDate)
      ? { ...data.wordsByDate }
      : {}

  Object.keys(wordsByDate).forEach((key) => {
    const value = Math.max(0, Math.floor(Number(wordsByDate[key]) || 0))
    if (value > 0) wordsByDate[key] = value
    else delete wordsByDate[key]
  })

  return {
    version: 1,
    bootstrapped: Boolean(data?.bootstrapped),
    wordsByDate,
  }
}

export function loadWritingActivity() {
  return normalize(readStorage())
}

export function isWritingActivityBootstrapped() {
  return loadWritingActivity().bootstrapped
}

export function getActivityWordsByDate() {
  return loadWritingActivity().wordsByDate
}

/**
 * 首次升级：用现存碎片按创建日快照填历史字数。
 * 已产生的当日增量取 max 合并，避免与快照双计。
 * 之后只增不减，删除碎片不会抹掉已写入天数。
 */
export function bootstrapWritingActivityFromNotes(notes = []) {
  const current = loadWritingActivity()
  if (current.bootstrapped) return current

  const wordsByDate = {}
  notes.forEach((note) => {
    if (note?.deletedAt || note?.pendingDelete) return
    const key = dateKeyFromNoteTime(note.createTime || note.createdAt)
    if (!key) return
    const chars = countWritingChars(
      note.markdownContent || note.rawContent || note.text || note.summary || '',
    )
    if (chars <= 0) return
    wordsByDate[key] = (wordsByDate[key] || 0) + chars
  })

  Object.entries(current.wordsByDate).forEach(([key, value]) => {
    wordsByDate[key] = Math.max(wordsByDate[key] || 0, value)
  })

  const next = { version: 1, bootstrapped: true, wordsByDate }
  writeStorage(next)
  return next
}

/**
 * 把一次内容净值记到「编辑发生日」（默认今天）。
 * +6 再 -4 → +2；当天字数夹到 ≥ 0。整条碎片删除不走这里。
 */
export function recordWritingDelta(delta, at = new Date()) {
  const amount = Math.floor(Number(delta) || 0)
  if (amount === 0) return false

  const key = toLocalDateKey(at)
  if (!key) return false

  const data = loadWritingActivity()
  const next = Math.max(0, (data.wordsByDate[key] || 0) + amount)
  if (next > 0) data.wordsByDate[key] = next
  else delete data.wordsByDate[key]
  writeStorage(data)
  return true
}
