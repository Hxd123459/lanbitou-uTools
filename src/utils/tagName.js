/** 标签名按「字」计：中文等全角 1 字，英文/数字等半角 0.5 字，上限 5 字 */
export const TAG_NAME_MAX_UNITS = 5

const CJK_RE =
  /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\ufe30-\ufe4f]/

export function getTagNameUnits(name) {
  let units = 0
  for (const char of String(name ?? '')) {
    units += CJK_RE.test(char) ? 1 : 0.5
  }
  return units
}

export function isTagNameWithinLimit(name) {
  return getTagNameUnits(name) <= TAG_NAME_MAX_UNITS
}

export function truncateTagNameToLimit(name) {
  const text = String(name ?? '')
  let units = 0
  let result = ''
  for (const char of text) {
    const weight = CJK_RE.test(char) ? 1 : 0.5
    if (units + weight > TAG_NAME_MAX_UNITS) break
    units += weight
    result += char
  }
  return result
}

export function clampTagNameInput(value) {
  return truncateTagNameToLimit(String(value ?? ''))
}

export const TAG_NAME_LIMIT_HINT = '最多 5 个字（英文按半字计，约 10 个字母）'
