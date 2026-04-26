const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080' : '')

export class ApiError extends Error {
  constructor(code, msg) {
    super(msg)
    this.name = 'ApiError'
    this.code = code
    this.msg = msg
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', '网络连接异常')
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(response.status || 'PARSE_ERROR', '响应解析失败')
  }

  if (payload?.code === 200) {
    return payload.data
  }

  const code = payload?.code ?? response.status ?? 'SYSTEM_ERROR'
  const msg = payload?.msg || '系统异常'
  throw new ApiError(code, msg)
}

export function post(path, body = {}) {
  return request(path, { method: 'POST', body })
}
