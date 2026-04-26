export function createChatStream(question, handlers = {}) {
  const text = String(question || '').trim()
  if (!text) {
    throw new Error('问题不能为空')
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
  const apiBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const url = `${apiBase}/api/chat/stream?question=${encodeURIComponent(text)}`
  const eventSource = new EventSource(url)
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    eventSource.close()
  }

  eventSource.onmessage = (event) => {
    const chunk = event.data || ''
    if (chunk === '[END]') {
      handlers.onEnd?.()
      close()
      return
    }
    handlers.onMessage?.(chunk)
  }

  eventSource.onerror = () => {
    handlers.onError?.(new Error('流式连接失败'))
    close()
  }

  return {
    close,
  }
}