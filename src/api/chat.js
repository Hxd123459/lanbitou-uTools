import { ApiError } from './http'

function normalizeStreamChunk(raw) {
  if (!raw || raw === '[DONE]') return ''

  try {
    const data = JSON.parse(raw)
    return (
      data?.delta ||
      data?.content ||
      data?.answer ||
      data?.message ||
      data?.token ||
      data?.data ||
      ''
    )
  } catch {
    return raw
  }
}

export async function streamChat(question, { onDelta } = {}) {
  const query = encodeURIComponent(question)
  let response

  try {
    response = await fetch(`/api/chat/stream?question=${query}`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', '网络连接异常')
  }

  if (!response.ok) {
    throw new ApiError(response.status, '流式问答请求失败')
  }

  if (!response.body) {
    throw new ApiError('NO_STREAM_BODY', '未收到流式响应体')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let eventDataLines = []

  const flushEvent = () => {
    if (!eventDataLines.length) return
    const payload = eventDataLines.join('\n')
    eventDataLines = []
    const delta = normalizeStreamChunk(payload)
    if (!delta) return
    onDelta?.(delta)
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) {
        flushEvent()
        continue
      }
      if (line.startsWith('data:')) {
        eventDataLines.push(line.slice(5).trimStart())
      } else {
        eventDataLines.push(line.trim())
      }
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    eventDataLines.push(buffer.trim())
  }
  flushEvent()
}
