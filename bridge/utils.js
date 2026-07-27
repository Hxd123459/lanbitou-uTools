export function createId() {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body ?? {})
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-cursor-api-key, x-agent-provider',
  })
  res.end(payload)
}

export async function readJsonBody(req, { limit = 2_000_000 } = {}) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      const err = new Error('请求体过大')
      err.code = 'BODY_TOO_LARGE'
      throw err
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw)
}
