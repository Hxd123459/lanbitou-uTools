import { BASE_URL } from './http'

/**
 * 流式问答（Web 模式，对接后端 SSE）
 * @returns {() => void} 取消函数
 */
export function streamChatFromBackend(question, { onDelta, onDone, onError } = {}) {
  const url = `${BASE_URL}/api/chat/stream?question=${encodeURIComponent(question)}`
  const source = new EventSource(url)
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    source.close()
  }

  source.onmessage = (event) => {
    const data = event.data
    if (data === '[END]') {
      close()
      onDone?.()
      return
    }
    onDelta?.(data)
  }

  source.onerror = () => {
    close()
    onError?.(new Error('连接中断，请稍后重试'))
  }

  return close
}
