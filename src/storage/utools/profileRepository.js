import { NOTE_PREFIX, PROFILE_PREFIX } from './constants'
import { dbAllDocs, dbGet, dbPut, dbRemove } from './dbClient'
import { formatDateTime } from './utils'

export const PROFILE_TYPES = {
  writingStyle: 'writing-style',
  persona: 'persona',
}

const CHECKPOINT_ID = `${PROFILE_PREFIX}checkpoint`

/** 触发再分析的阈值：新增碎片条数 / 距上次分析天数 / 首次分析所需最少碎片数 */
export const REANALYZE_MIN_NEW_NOTES = 30
export const REANALYZE_MAX_AGE_DAYS = 7
export const MIN_NOTES_FOR_ANALYSIS = 10

function isDbAvailable() {
  return typeof window !== 'undefined' && !!window.utools?.db
}

function profileDocId(type) {
  return `${PROFILE_PREFIX}${type}`
}

function stripDoc(doc) {
  if (!doc || doc.error) return null
  const { _id, _rev, ...rest } = doc
  return rest
}

export async function loadProfile(type) {
  if (!isDbAvailable()) return null
  try {
    return stripDoc(await dbGet(profileDocId(type)))
  } catch {
    return null
  }
}

/** 合并式保存，自动递增 version、刷新 updatedAt */
export async function saveProfile(type, patch = {}) {
  const existing = (await loadProfile(type)) || {}
  const doc = {
    ...existing,
    ...patch,
    version: (existing.version || 0) + 1,
    updatedAt: formatDateTime(),
    _id: profileDocId(type),
  }
  await dbPut(doc)
  const { _id, ...rest } = doc
  return rest
}

export async function loadCheckpoint() {
  if (!isDbAvailable()) return null
  try {
    return stripDoc(await dbGet(CHECKPOINT_ID))
  } catch {
    return null
  }
}

export async function saveCheckpoint(data) {
  await dbPut({ ...data, _id: CHECKPOINT_ID })
}

export async function clearCheckpoint() {
  if (!isDbAvailable()) return
  try {
    const existing = await dbGet(CHECKPOINT_ID)
    if (existing && !existing.error) await dbRemove(CHECKPOINT_ID)
  } catch {
    // ignore
  }
}

export async function countActiveFragments() {
  if (!isDbAvailable()) return 0
  const docs = await dbAllDocs(NOTE_PREFIX)
  return (docs || []).filter((doc) => doc && !doc.deletedAt && !doc.archivedAt).length
}

function ageInDays(dateTimeText) {
  const time = new Date(String(dateTimeText || '').replace(' ', 'T')).getTime()
  if (Number.isNaN(time)) return Infinity
  return (Date.now() - time) / (24 * 60 * 60 * 1000)
}

function profileNeedsUpdate(profile, activeCount) {
  if (!profile) return true
  if (profile.manualLocked) return false
  const analyzedCount = profile.source?.analyzedCount || 0
  if (activeCount - analyzedCount >= REANALYZE_MIN_NEW_NOTES) return true
  if (ageInDays(profile.updatedAt) > REANALYZE_MAX_AGE_DAYS && activeCount > analyzedCount) {
    return true
  }
  return false
}

export async function shouldReanalyze() {
  if (!isDbAvailable()) return false
  const activeCount = await countActiveFragments()
  if (activeCount < MIN_NOTES_FOR_ANALYSIS) return false

  const [style, persona] = await Promise.all([
    loadProfile(PROFILE_TYPES.writingStyle),
    loadProfile(PROFILE_TYPES.persona),
  ])
  return profileNeedsUpdate(style, activeCount) || profileNeedsUpdate(persona, activeCount)
}
