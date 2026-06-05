export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080' : '')

/**
 * 把后端返回的资源路径解析为可被 <img>/<video> 直接使用的完整 URL。
 * 已是 http(s) 绝对地址 → 原样返回；否则拼上 BASE_URL。
 */
export function resolveResourceUrl(path) {
  if (!path) return ''
  if (/^(https?:|blob:)/i.test(path)) return path
  return `${BASE_URL}${path}`
}

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

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'code' in payload) {
    if (payload.code === 200) {
      return payload.data
    }
    const code = payload.code ?? response.status ?? 'SYSTEM_ERROR'
    const msg = payload.msg || '系统异常'
    throw new ApiError(code, msg)
  }

  return payload
}

export function post(path, body = {}) {
  return request(path, { method: 'POST', body })
}

export function get(path, params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(query ? `${path}?${query}` : path)
}

export function postForm(path, formData, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}${path}`, true)

    if (typeof onProgress === 'function' && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded / event.total)
        }
      }
    }

    xhr.onerror = () => reject(new ApiError('NETWORK_ERROR', '网络连接异常'))
    xhr.onabort = () => reject(new ApiError('ABORTED', '请求已取消'))

    xhr.onload = () => {
      let payload = null
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        reject(new ApiError(xhr.status || 'PARSE_ERROR', '响应解析失败'))
        return
      }
      if (payload?.code === 200) {
        if (typeof onProgress === 'function') onProgress(1)
        resolve(payload.data)
        return
      }
      const code = payload?.code ?? xhr.status ?? 'SYSTEM_ERROR'
      const msg = payload?.msg || '系统异常'
      reject(new ApiError(code, msg))
    }

    xhr.send(formData)
  })
}
