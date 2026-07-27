import { computed, onBeforeUnmount, ref } from 'vue'
import {
  agentCancelRun,
  agentGetRun,
  agentStartRun,
  ensureAgentBridge,
  isAgentBridgeAvailable,
  pathExists,
} from '../api/agentBridge'
import {
  createTodoRun,
  fetchTodoRun,
  fetchTodoRunsByTodo,
  updateTodoRun,
} from '../api/todoRun'
import { updateTodo } from '../api/todo'
import {
  TODO_RUN_STATUS,
  TODO_RUN_STATUS_LABEL,
} from '../constants/todoRunStatus'
import { formatDateTime } from '../storage/utools/utils'

function buildPrompt(todo) {
  const lines = [`待办：${todo.title}`]
  if (todo.sourceExcerpt) lines.push(`来源摘录：${todo.sourceExcerpt}`)
  if (todo.sourceNoteTitle) lines.push(`来源标题：${todo.sourceNoteTitle}`)
  if (todo.sourceTagName) lines.push(`来源标签：#${todo.sourceTagName}`)
  lines.push('请在当前仓库完成该待办，保持改动最小且可验证。')
  return lines.join('\n')
}

function buildContinuePrompt(todo, feedback, prevRun) {
  const lines = [
    '请根据以下反馈继续修改（保留与反馈无关的已有正确改动）。完成后用简短中文总结本轮改动，并列出改动文件。',
    '',
    `原待办：${todo.title}`,
  ]
  if (feedback) lines.push(`用户反馈：${feedback}`)
  else lines.push('用户反馈：（未填写具体说明，请自行检查并完善上一轮结果）')
  if (prevRun?.summary) lines.push(`上一轮摘要：${prevRun.summary}`)
  if (prevRun?.changedFiles?.length) {
    lines.push(`上一轮改动文件：${prevRun.changedFiles.join('、')}`)
  }
  return lines.join('\n')
}

/**
 * @param {object} options
 * @param {() => object|null} options.getProject
 * @param {() => any[]} options.getTodos
 * @param {(todo: any) => void} options.patchTodoLocal
 * @param {(msg: string) => void} [options.onToast]
 * @param {(err: any) => void} [options.onError]
 */
export function useTodoRunQueue({
  getProject,
  getTodos,
  patchTodoLocal,
  onToast,
  onError,
} = {}) {
  const queueIds = ref([])
  const activeTodoId = ref(null)
  const activeRunId = ref(null)
  const runByTodoId = ref({})
  const pumping = ref(false)
  /** @type {Record<string, { agentId?: string|null, feedback?: string, mode?: 'create'|'resume' }>} */
  const startOptionsByTodoId = {}
  let pollTimer = null

  const queueLength = computed(() => queueIds.value.length)
  const runningTitle = computed(() => {
    const id = activeTodoId.value
    if (!id) return ''
    const todo = (getTodos?.() || []).find((item) => item.id === id)
    return todo?.title || ''
  })

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const setRunCache = (todoId, run) => {
    if (!todoId || !run) return
    const key = String(todoId)
    const prev = runByTodoId.value[key]
    runByTodoId.value = {
      ...runByTodoId.value,
      [key]: {
        ...run,
        history: Array.isArray(run.history)
          ? run.history
          : Array.isArray(prev?.history)
            ? prev.history
            : undefined,
      },
    }
  }

  const applyTodoPatch = async (todoId, patch) => {
    const updated = await updateTodo(todoId, patch)
    patchTodoLocal?.(updated)
    return updated
  }

  const resolveAgentId = async (todo) => {
    if (!todo?.id) return null
    const cached = runByTodoId.value[String(todo.id)]
    if (cached?.agentId) return cached.agentId
    if (todo.lastRunId) {
      const run = await fetchTodoRun(todo.lastRunId)
      if (run?.agentId) return run.agentId
    }
    const runs = await fetchTodoRunsByTodo(todo.id, { limit: 1 })
    return runs[0]?.agentId || null
  }

  const enqueueIds = async (todoIds, optionsById = {}) => {
    const project = getProject?.()
    if (!project?.localPath) {
      throw new Error('请先在事情中关联本地项目路径')
    }
    if (!pathExists(project.localPath)) {
      throw new Error('本地项目路径不存在')
    }
    if (!isAgentBridgeAvailable()) {
      throw new Error('Agent 桥不可用，请在 uTools 中使用')
    }

    const todos = getTodos?.() || []
    const idSet = new Set((todoIds || []).map(String))
    const list = todos.filter((todo) => idSet.has(String(todo?.id)))
    if (!list.length) throw new Error('没有可入队的待办')

    const nextQueue = [...queueIds.value]
    let added = 0
    for (const todo of list) {
      const id = String(todo.id)
      if (nextQueue.includes(id) || nextQueue.includes(todo.id)) continue
      if (
        todo.runStatus === TODO_RUN_STATUS.RUNNING ||
        todo.runStatus === TODO_RUN_STATUS.QUEUED
      ) {
        continue
      }
      const opts = optionsById[id] || optionsById[todo.id] || {}
      startOptionsByTodoId[id] = opts
      nextQueue.push(todo.id)
      await applyTodoPatch(todo.id, {
        done: false,
        runStatus: TODO_RUN_STATUS.QUEUED,
      })
      added += 1
    }
    queueIds.value = nextQueue
    if (added) {
      onToast?.(`已加入队列 ${added} 条`)
      void pump()
    }
    return added
  }

  const enqueue = async (todos = []) => {
    const list = (Array.isArray(todos) ? todos : []).filter(
      (todo) => todo?.id && !todo.done,
    )
    if (!list.length) throw new Error('请先勾选未完成的待办')
    return enqueueIds(list.map((t) => t.id))
  }

  const continueTodo = async (todo, feedback = '') => {
    if (!todo?.id) return
    const prevDetail = await loadRunForTodo(todo)
    const agentId = prevDetail?.agentId || (await resolveAgentId(todo))
    const text = String(feedback || '').trim()
    await enqueueIds([todo.id], {
      [String(todo.id)]: {
        mode: agentId ? 'resume' : 'create',
        agentId: agentId || null,
        feedback: text,
        prevRun: prevDetail
          ? {
              summary: prevDetail.summary || '',
              changedFiles: prevDetail.changedFiles || [],
            }
          : null,
      },
    })
  }

  const pump = async () => {
    if (pumping.value) return
    pumping.value = true
    try {
      while (true) {
        if (activeTodoId.value) break
        const nextId = queueIds.value[0]
        if (!nextId) break
        queueIds.value = queueIds.value.slice(1)
        await startOne(nextId)
      }
    } finally {
      pumping.value = false
    }
  }

  const startOne = async (todoId) => {
    const project = getProject?.()
    const todo = (getTodos?.() || []).find((item) => item.id === todoId)
    const startOpts = startOptionsByTodoId[String(todoId)] || {}
    delete startOptionsByTodoId[String(todoId)]

    if (!project?.localPath || !todo) {
      await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.FAILED }).catch(() => {})
      return
    }

    activeTodoId.value = todoId
    clearPoll()

    try {
      await ensureAgentBridge()
      const isResume = startOpts.mode === 'resume' && startOpts.agentId
      const prompt = isResume
        ? buildContinuePrompt(todo, startOpts.feedback, startOpts.prevRun)
        : startOpts.feedback
          ? buildContinuePrompt(todo, startOpts.feedback, startOpts.prevRun)
          : buildPrompt(todo)

      const runDoc = await createTodoRun({
        todoId,
        projectId: project.id,
        provider: 'cursor',
        prompt,
        status: 'running',
      })
      activeRunId.value = runDoc.id
      setRunCache(todoId, runDoc)
      await applyTodoPatch(todoId, {
        runStatus: TODO_RUN_STATUS.RUNNING,
        lastRunId: runDoc.id,
      })
      await updateTodoRun(runDoc.id, {
        startedAt: formatDateTime(),
        status: 'running',
      })

      const started = await agentStartRun({
        cwd: project.localPath,
        todoId,
        prompt,
        provider: 'cursor',
        agentId: isResume ? startOpts.agentId : undefined,
      })
      const bridgeRunId = started?.run?.id
      if (!bridgeRunId) throw new Error('桥未返回 run id')

      const agentId = started.run.agentId || (isResume ? startOpts.agentId : null)
      await updateTodoRun(runDoc.id, { bridgeRunId, agentId })
      setRunCache(todoId, { ...runDoc, bridgeRunId, agentId })

      await pollUntilDone(todoId, runDoc.id, bridgeRunId)
    } catch (error) {
      onError?.(error)
      try {
        if (activeRunId.value) {
          await updateTodoRun(activeRunId.value, {
            status: 'error',
            error: error?.message || String(error),
            finishedAt: formatDateTime(),
          })
        }
        await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.FAILED })
      } catch {
        /* ignore */
      }
    } finally {
      clearPoll()
      activeTodoId.value = null
      activeRunId.value = null
      void pump()
    }
  }

  const pollUntilDone = (todoId, runId, bridgeRunId) =>
    new Promise((resolve) => {
      const tick = async () => {
        try {
          const data = await agentGetRun(bridgeRunId)
          const remote = data?.run || {}
          const patched = await updateTodoRun(runId, {
            status: remote.status || 'running',
            log: remote.log || '',
            summary: remote.summary || '',
            changedFiles: remote.changedFiles || [],
            usage: remote.usage || null,
            agentId: remote.agentId || null,
            error: remote.error || '',
          })
          setRunCache(todoId, patched)

          const status = String(remote.status || '')
          if (status === 'finished' || status === 'error' || status === 'cancelled') {
            clearPoll()
            await updateTodoRun(runId, {
              finishedAt: formatDateTime(),
              status,
            })
            if (status === 'finished') {
              await applyTodoPatch(todoId, {
                runStatus: TODO_RUN_STATUS.PENDING_REVIEW,
              })
              onToast?.('待办执行完成，请验收')
            } else {
              await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.FAILED })
              onToast?.(status === 'cancelled' ? '已取消执行' : '执行失败')
            }
            resolve()
            return
          }
        } catch (error) {
          clearPoll()
          onError?.(error)
          await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.FAILED }).catch(() => {})
          resolve()
        }
      }

      void tick()
      pollTimer = setInterval(tick, 2000)
    })

  const acceptTodo = async (todo) => {
    if (!todo?.id) return
    await applyTodoPatch(todo.id, {
      done: true,
      runStatus: TODO_RUN_STATUS.IDLE,
    })
    onToast?.('已验收通过')
  }

  const rejectTodo = async (todo, { requeue = false } = {}) => {
    if (!todo?.id) return
    if (requeue) {
      await continueTodo(todo, '')
      return
    }
    await applyTodoPatch(todo.id, {
      done: false,
      runStatus: TODO_RUN_STATUS.IDLE,
    })
    onToast?.('已打回')
  }

  const dismissFailed = async (todo) => {
    if (!todo?.id) return
    await applyTodoPatch(todo.id, { runStatus: TODO_RUN_STATUS.IDLE })
  }

  const cancelActive = async () => {
    const todoId = activeTodoId.value
    const runId = activeRunId.value
    if (!todoId || !runId) return
    try {
      const run = await fetchTodoRun(runId)
      if (run?.bridgeRunId) await agentCancelRun(run.bridgeRunId)
    } catch (error) {
      onError?.(error)
    }
  }

  const loadRunForTodo = async (todo) => {
    if (!todo?.id) return null
    const todoId = String(todo.id)
    const cached = runByTodoId.value[todoId]
    if (cached?.history?.length) return cached

    let runs = await fetchTodoRunsByTodo(todoId, { limit: 50 })
    if (!runs.length && todo.lastRunId) {
      const single = await fetchTodoRun(todo.lastRunId)
      if (single) runs = [single]
    }
    if (!runs.length) return null

    const detail = { ...runs[0], history: runs }
    setRunCache(todoId, detail)
    return detail
  }

  onBeforeUnmount(() => {
    clearPoll()
  })

  return {
    queueIds,
    queueLength,
    activeTodoId,
    runningTitle,
    runByTodoId,
    enqueue,
    continueTodo,
    acceptTodo,
    rejectTodo,
    dismissFailed,
    cancelActive,
    loadRunForTodo,
    statusLabel: TODO_RUN_STATUS_LABEL,
  }
}
