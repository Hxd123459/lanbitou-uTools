import { createId } from '../utils.js'

function getApiKey(options = {}) {
  return String(options.apiKey || process.env.CURSOR_API_KEY || '').trim()
}

async function loadCursorSdk() {
  try {
    return await import('@cursor/sdk')
  } catch (error) {
    const err = new Error(
      `无法加载 @cursor/sdk，请在 bridge 目录执行 npm install。${error?.message || ''}`,
    )
    err.code = 'SDK_MISSING'
    throw err
  }
}

function notesToPrompt(notes = []) {
  const list = Array.isArray(notes) ? notes : []
  const blocks = list.slice(0, 40).map((note, index) => {
    const title = String(note?.title || note?.tagName || '未命名').trim()
    const body = String(note?.markdownContent || note?.rawContent || note?.text || '').trim()
    return `### 碎片 ${index + 1}\nid: ${note?.id || ''}\n标题/标签: ${title}\n内容:\n${body.slice(0, 2000)}`
  })
  return [
    '你是资深工程师助手。请结合当前代码仓库，从以下碎片笔记中提取可执行的开发待办。',
    '要求：',
    '1. 只输出 JSON 数组，不要 markdown 代码块以外的解释。',
    '2. 每项字段：title(string), sourceNoteId(string|null), excerpt(string), reason(string)',
    '3. title 要具体可执行；结合仓库现状，避免已完成或无法落地的项。',
    '4. 最多 20 条。',
    '',
    blocks.join('\n\n') || '（无碎片内容）',
  ].join('\n')
}

function parseJsonArray(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start < 0 || end < start) return []
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function collectTextFromResult(result) {
  if (!result) return ''
  if (typeof result.result === 'string') return result.result
  if (typeof result.text === 'string') return result.text
  if (typeof result === 'string') return result
  try {
    return JSON.stringify(result)
  } catch {
    return String(result)
  }
}

export default {
  id: 'cursor',

  async extract({ cwd, notes, apiKey, model } = {}) {
    const key = getApiKey({ apiKey })
    if (!key) {
      const err = new Error('缺少 CURSOR_API_KEY')
      err.code = 'NO_API_KEY'
      throw err
    }
    const { Agent } = await loadCursorSdk()
    const prompt = notesToPrompt(notes)
    const result = await Agent.prompt(prompt, {
      apiKey: key,
      model: { id: model || 'composer-2.5' },
      local: { cwd },
    })
    const text = collectTextFromResult(result)
    const items = parseJsonArray(text)
      .map((item) => ({
        title: String(item?.title || '').trim(),
        sourceNoteId: item?.sourceNoteId ? String(item.sourceNoteId) : null,
        excerpt: String(item?.excerpt || item?.reason || '').trim().slice(0, 240),
        reason: String(item?.reason || '').trim().slice(0, 240),
      }))
      .filter((item) => item.title)
    return { items, raw: text.slice(0, 4000), status: result?.status || 'finished' }
  },

  async execute({ cwd, prompt, apiKey, model, onEvent } = {}) {
    const key = getApiKey({ apiKey })
    if (!key) {
      const err = new Error('缺少 CURSOR_API_KEY')
      err.code = 'NO_API_KEY'
      throw err
    }
    const { Agent } = await loadCursorSdk()
    const runId = createId()
    const state = {
      id: runId,
      status: 'running',
      log: '',
      summary: '',
      changedFiles: [],
      agentId: null,
      error: '',
      cancelRequested: false,
      agent: null,
      run: null,
    }

    const appendLog = (chunk) => {
      const text = String(chunk || '')
      if (!text) return
      state.log = `${state.log}${text}`.slice(-20000)
      onEvent?.({ type: 'log', log: state.log })
    }

    ;(async () => {
      try {
        const agent = await Agent.create({
          apiKey: key,
          model: { id: model || 'composer-2.5' },
          local: { cwd },
        })
        state.agent = agent
        state.agentId = agent.agentId || null
        onEvent?.({ type: 'agent', agentId: state.agentId })

        const run = await agent.send(
          [
            '请完成以下待办。完成后用简短中文总结改动，并尽量列出改动文件路径。',
            '',
            String(prompt || '').trim(),
          ].join('\n'),
        )
        state.run = run

        if (typeof run.stream === 'function') {
          for await (const event of run.stream()) {
            if (state.cancelRequested) break
            if (event?.type === 'assistant') {
              const content = event?.message?.content
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block?.type === 'text' && block.text) appendLog(block.text)
                }
              }
            } else if (event?.type === 'tool_call' || event?.type === 'tool') {
              appendLog(`\n[tool] ${JSON.stringify(event).slice(0, 500)}\n`)
            }
          }
        }

        if (typeof run.wait === 'function') {
          const waited = await run.wait()
          const status = waited?.status || resultStatus(waited)
          state.summary =
            String(waited?.result || waited?.summary || collectTextFromResult(waited) || '')
              .trim()
              .slice(0, 4000) || state.log.slice(-1200)
          if (Array.isArray(waited?.changedFiles)) {
            state.changedFiles = waited.changedFiles.map(String)
          }
          state.status =
            state.cancelRequested
              ? 'cancelled'
              : status === 'error' || status === 'failed'
                ? 'error'
                : 'finished'
          if (state.status === 'error') {
            state.error = String(waited?.error || waited?.message || '执行失败')
          }
        } else {
          state.status = state.cancelRequested ? 'cancelled' : 'finished'
          state.summary = state.log.slice(-1200)
        }
      } catch (error) {
        state.status = 'error'
        state.error = error?.message || String(error)
        appendLog(`\n[error] ${state.error}\n`)
      } finally {
        try {
          if (state.agent && typeof state.agent[Symbol.asyncDispose] === 'function') {
            await state.agent[Symbol.asyncDispose]()
          } else if (state.agent && typeof state.agent.close === 'function') {
            await state.agent.close()
          }
        } catch {
          /* ignore */
        }
        onEvent?.({
          type: 'done',
          status: state.status,
          log: state.log,
          summary: state.summary,
          changedFiles: state.changedFiles,
          agentId: state.agentId,
          error: state.error,
        })
      }
    })()

    return {
      id: runId,
      getState: () => ({
        id: state.id,
        status: state.status,
        log: state.log,
        summary: state.summary,
        changedFiles: state.changedFiles,
        agentId: state.agentId,
        error: state.error,
      }),
      cancel: async () => {
        state.cancelRequested = true
        try {
          if (state.run && typeof state.run.cancel === 'function') await state.run.cancel()
        } catch {
          /* ignore */
        }
        return true
      },
    }
  },
}

function resultStatus(result) {
  if (!result) return 'finished'
  return result.status || 'finished'
}
