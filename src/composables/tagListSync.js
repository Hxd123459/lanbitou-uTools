const listeners = new Set()

export function subscribeTagListInvalidate(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function invalidateTagList() {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.warn('[烂笔头] 刷新标签列表失败', error)
    }
  })
}
