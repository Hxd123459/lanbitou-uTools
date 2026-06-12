export const UNTAGGED_TAG_ID = '__untagged__'
export const UNTAGGED_TAG_NAME = '无标签'

export function isUntaggedTag(tag) {
  return String(tag?.tagId ?? '') === UNTAGGED_TAG_ID
}
