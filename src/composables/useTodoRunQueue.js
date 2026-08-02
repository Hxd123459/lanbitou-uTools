import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  agentArchive,
  agentCancelRun,
  agentGetRun,
  agentGitDiff,
  agentStartRun,
  ensureAgentBridge,
  isAgentBridgeAvailable,
  pathExists,
} from '../api/agentBridge'
import { createNoteInFolder } from '../api/structFolder'
import {
  createTodoRun,
  fetchTodoRun,
  fetchTodoRunsByProject,
  fetchTodoRunsByTodo,
  updateTodoRun,
} from '../api/todoRun'
import { resetOrphanRunTodos, updateTodo } from '../api/todo'
import {
  isContinueQueuedStartOptions,
  normalizeTodoRunStatus,
  TODO_RUN_STATUS,
  TODO_RUN_STATUS_LABEL,
} from '../constants/todoRunStatus'
import {
  shouldSkipPollTick,
  wasRunSessionCancelled,
} from '../utils/todoRunQueueCancel'
import { shouldPumpAfterEnqueue } from '../utils/todoRunQueueEnqueue'
import { patchQueuedContinueFeedback } from '../utils/todoRunQueueFeedback'
import { formatDateTime } from '../storage/utools/utils'
import {
  buildCancelledRunPatch,
  isTerminalRunStatus,
  mapTerminalRunToTodoRunStatus,
} from '../utils/todoRunTerminal'

function buildPrompt(todo) {
  const lines = [`待办：${todo.title}`]
  if (todo.doneWhen) lines.push(`验收标准：${todo.doneWhen}`)
  if (todo.sourceExcerpt) lines.push(`来源摘录：${todo.sourceExcerpt}`)
  if (todo.sourceNoteTitle) lines.push(`来源标题：${todo.sourceNoteTitle}`)
  if (todo.sourceTagName) lines.push(`来源标签：#${todo.sourceTagName}`)
  lines.push('请在当前仓库完成该待办，保持改动最小且可验证。')
  return lines.join('\n')
}

function buildContinuePrompt(todo, feedback, prevRun) {
  const lines = [
    '请根据以下反馈继续修改（保留与反馈无关的已有正确改动）。',
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

let orphanRunResetPromise = null

async function ensureOrphanRunsReset({ patchTodoLocal, onToast } = {}) {
  if (!orphanRunResetPromise) {
    orphanRunResetPromise = (async () => {
      try {
        const updated = await resetOrphanRunTodos()
        if (updated.length) {
          for (const todo of updated) patchTodoLocal?.(todo)
          onToast?.(`已将 ${updated.length} 条中断任务重置为未完成`)
        }
        return updated
      } catch {
        return []
      }
    })()
  }
  return orphanRunResetPromise
}

function branchNameForTodo(todoId) {
  const safe = String(todoId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 24)
  return `lanbitou/${safe || 'todo'}`
}

async function syncArchiveMeta(project) {
  // 本地档案目录仅兼容旧数据；新流程写入沉淀文件夹
  if (!project?.archivePath || !pathExists(project.archivePath)) return
  try {
    await agentArchive({
      action: 'ensure',
      archivePath: project.archivePath,
    })
    await agentArchive({
      action: 'syncReadme',
      archivePath: project.archivePath,
      project: {
        name: project.name,
        purpose: project.purpose,
        successLooksLike: project.successLooksLike,
        outOfScope: project.outOfScope,
      },
    })
  } catch {
    /* ignore archive sync errors */
  }
}

async function persistAcceptedRun(project, todo, run) {
  if (!run) return

  if (project?.sedimentFolderId) {
    try {
      const date = formatDateTime().slice(0, 10)
      const lines = [
        `# 验收通过 · ${todo?.title || '待办'}`,
        '',
        `- 日期：${date}`,
        `- 分支：${run.branchName || '—'}`,
        `- 基准：${run.baseRef || '—'}`,
      ]
      if (run.reviewNote) lines.push(`- 验收备注：${run.reviewNote}`)
      if (run.summary) {
        lines.push('', '## 摘要', '', run.summary)
      }
      if (Array.isArray(run.changedFiles) && run.changedFiles.length) {
        lines.push('', '## 改动文件', '', ...run.changedFiles.map((f) => `- ${f}`))
      }
      await createNoteInFolder({
        parentId: project.sedimentFolderId,
        title: `验收 · ${todo?.title || '待办'} · ${date}`,
        content: lines.join('\n'),
      })
    } catch {
      /* ignore */
    }
    return
  }

  if (!project?.archivePath || !pathExists(project.archivePath)) return
  try {
    await agentArchive({
      action: 'writeRun',
      archivePath: project.archivePath,
      run: {
        id: run.id,
        todoTitle: todo?.title || '',
        status: 'accepted',
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        branchName: run.branchName,
        baseRef: run.baseRef,
        summary: run.summary,
        reviewNote: run.reviewNote,
        checklist: run.checklist,
        changedFiles: run.changedFiles,
        usage: run.usage,
      },
    })
    const line = run.reviewNote
      ? `${todo?.title || '待办'} — ${run.reviewNote}`
      : `${todo?.title || '待办'} — 验收通过`
    await agentArchive({
      action: 'appendChangelog',
      archivePath: project.archivePath,
      line,
    })
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} options
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
  const startOptionsByTodoId = ref({})
  let pollTimer = null
  let releasePoll = null

  const queueLength = computed(() => queueIds.value.length)
  const runControlActive = computed(
    () => Boolean(activeTodoId.value) || queueIds.value.length > 0,
  )
  const runningTitle = computed(() => {
    const id = activeTodoId.value
    if (!id) return ''
    const todo = (getTodos?.() || []).find((item) => item.id === id)
    return todo?.title || ''
  })

  const continueQueuedTodoIds = computed(() => {
    const ids = new Set()
    for (const [id, opts] of Object.entries(startOptionsByTodoId.value)) {
      if (isContinueQueuedStartOptions(opts)) ids.add(id)
    }
    return ids
  })

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const endPoll = () => {
    clearPoll()
    if (releasePoll) {
      const release = releasePoll
      releasePoll = null
      release()
    }
  }

  const finalizeCancelledRun = async (todoId, runId, { notify = true } = {}) => {
    const run = await fetchTodoRun(runId)
    if (run?.finishedAt) return run
    const finished = await updateTodoRun(runId, buildCancelledRunPatch(formatDateTime()))
    await refreshRunHistory(todoId, finished)
    await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.IDLE })
    if (notify) onToast?.('已取消执行')
    return finished
  }

  const setRunCache = (todoId, run) => {
    if (!todoId || !run) return
    const key = String(todoId)
    const prev = runByTodoId.value[key]
    const history = Array.isArray(run.history)
      ? run.history
      : Array.isArray(prev?.history)
        ? prev.history.map((item) => (item?.id === run.id ? { ...item, ...run } : item))
        : undefined
    runByTodoId.value = {
      ...runByTodoId.value,
      [key]: {
        ...run,
        history,
      },
    }
  }

  const refreshRunHistory = async (todoId, preferredRun = null) => {
    const key = String(todoId || '').trim()
    if (!key) return null
    let runs = await fetchTodoRunsByTodo(key, { limit: 50 })
    if (!runs.length && preferredRun?.id) runs = [preferredRun]
    if (!runs.length) return null
    const latest =
      (preferredRun?.id && runs.find((item) => item.id === preferredRun.id)) ||
      runs[0]
    const detail = {
      ...latest,
      ...preferredRun,
      id: latest.id,
      history: runs.map((item) =>
        preferredRun?.id === item.id ? { ...item, ...preferredRun } : item,
      ),
    }
    setRunCache(key, detail)
    return detail
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
      startOptionsByTodoId.value = { ...startOptionsByTodoId.value, [id]: opts }
      nextQueue.push(todo.id)
      await applyTodoPatch(todo.id, {
        done: false,
        runStatus: TODO_RUN_STATUS.QUEUED,
      })
      added += 1
    }
    queueIds.value = nextQueue
    if (added) {
      onToast?.(
        activeTodoId.value
          ? `已加入排队 ${added} 条，当前任务执行中`
          : `已加入队列 ${added} 条`,
      )
      if (shouldPumpAfterEnqueue(activeTodoId.value)) {
        void pump()
      }
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

  const updateQueuedContinueFeedback = (todo, feedback = '') => {
    if (!todo?.id) return false
    const id = String(todo.id)
    if (normalizeTodoRunStatus(todo.runStatus) !== TODO_RUN_STATUS.QUEUED) return false
    if (activeTodoId.value && String(activeTodoId.value) === id) return false
    const next = patchQueuedContinueFeedback(startOptionsByTodoId.value, id, feedback)
    if (!next) return false
    startOptionsByTodoId.value = next
    onToast?.('已更新继续改反馈')
    return true
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

  const wasRunCancelled = (todoId) =>
    wasRunSessionCancelled(activeTodoId.value, todoId)

  const startOne = async (todoId) => {
    activeTodoId.value = todoId
    clearPoll()

    const project = getProject?.()
    const todo = (getTodos?.() || []).find((item) => item.id === todoId)
    const startOpts = startOptionsByTodoId.value[String(todoId)] || {}
    const nextStartOptions = { ...startOptionsByTodoId.value }
    delete nextStartOptions[String(todoId)]
    startOptionsByTodoId.value = nextStartOptions

    if (!project?.localPath || !todo) {
      await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.FAILED }).catch(() => {})
      return
    }

    try {
      await ensureAgentBridge()
      await syncArchiveMeta(project)
      if (wasRunCancelled(todoId)) return

      const isResume = startOpts.mode === 'resume' && startOpts.agentId
      const prompt = isResume || startOpts.feedback
        ? buildContinuePrompt(todo, startOpts.feedback, startOpts.prevRun)
        : buildPrompt(todo)

      const branchName = branchNameForTodo(todoId)
      const runDoc = await createTodoRun({
        todoId,
        projectId: project.id,
        provider: 'cursor',
        prompt,
        status: 'running',
        branchName,
      })
      activeRunId.value = runDoc.id
      if (wasRunCancelled(todoId)) return
      const prevDetail = runByTodoId.value[String(todoId)]
      const prevHistory = Array.isArray(prevDetail?.history)
        ? prevDetail.history
        : prevDetail?.id
          ? [prevDetail]
          : []
      setRunCache(todoId, {
        ...runDoc,
        history: [runDoc, ...prevHistory.filter((item) => item?.id !== runDoc.id)],
      })
      if (wasRunCancelled(todoId)) return
      await applyTodoPatch(todoId, {
        runStatus: TODO_RUN_STATUS.RUNNING,
        lastRunId: runDoc.id,
      })
      const startedRun = await updateTodoRun(runDoc.id, {
        startedAt: formatDateTime(),
        status: 'running',
      })
      if (wasRunCancelled(todoId)) return
      setRunCache(todoId, {
        ...startedRun,
        history: [
          startedRun,
          ...prevHistory.filter((item) => item?.id !== startedRun.id),
        ],
      })

      const started = await agentStartRun({
        cwd: project.localPath,
        todoId,
        prompt,
        provider: 'cursor',
        agentId: isResume ? startOpts.agentId : undefined,
        createBranch: !isResume,
        branchName,
      })
      const bridgeRunId = started?.run?.id
      if (!bridgeRunId) throw new Error('桥未返回 run id')
      if (wasRunCancelled(todoId)) {
        await agentCancelRun(bridgeRunId).catch(() => {})
        return
      }

      const agentId = started.run.agentId || (isResume ? startOpts.agentId : null)
      const baseRef = started.run.baseRef || started.baseline?.baseRef || null
      const linkedRun = await updateTodoRun(runDoc.id, {
        bridgeRunId,
        agentId,
        baseRef,
        branchName: started.run.branchName || branchName,
      })
      setRunCache(todoId, {
        ...linkedRun,
        history: [
          linkedRun,
          ...prevHistory.filter((item) => item?.id !== linkedRun.id),
        ],
      })

      await pollUntilDone(todoId, runDoc.id, bridgeRunId)
    } catch (error) {
      if (wasRunCancelled(todoId)) return
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
      releasePoll = resolve
      const tick = async () => {
        try {
          const data = await agentGetRun(bridgeRunId)
          if (shouldSkipPollTick(releasePoll)) return
          const remote = data?.run || {}
          const patched = await updateTodoRun(runId, {
            status: remote.status || 'running',
            log: remote.log || '',
            summary: remote.summary || '',
            changedFiles: remote.changedFiles || [],
            checklist: remote.checklist || [],
            usage: remote.usage || null,
            agentId: remote.agentId || null,
            baseRef: remote.baseRef || null,
            branchName: remote.branchName || null,
            error: remote.error || '',
          })
          setRunCache(todoId, patched)

          const status = String(remote.status || '')
          if (isTerminalRunStatus(status)) {
            endPoll()
            const finished = await updateTodoRun(runId, {
              finishedAt: formatDateTime(),
              status,
            })
            await refreshRunHistory(todoId, finished)
            await applyTodoPatch(todoId, {
              runStatus: mapTerminalRunToTodoRunStatus(status),
            })
            if (status === 'finished') {
              onToast?.('待办执行完成，请验收')
            } else if (status === 'cancelled') {
              onToast?.('已取消执行')
            } else {
              onToast?.('执行失败')
            }
            return
          }
        } catch (error) {
          endPoll()
          onError?.(error)
          await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.FAILED }).catch(() => {})
        }
      }

      void tick()
      pollTimer = setInterval(tick, 2000)
    })

  const acceptTodo = async (todo, { reviewNote = '', checklist = null } = {}) => {
    if (!todo?.id) return
    const project = getProject?.()
    let run = null
    if (todo.lastRunId) {
      const patch = { reviewNote: String(reviewNote || '').trim() }
      if (Array.isArray(checklist)) patch.checklist = checklist
      run = await updateTodoRun(todo.lastRunId, patch)
      setRunCache(todo.id, run)
    }
    await applyTodoPatch(todo.id, {
      done: true,
      runStatus: TODO_RUN_STATUS.IDLE,
    })
    await persistAcceptedRun(project, todo, run)
    onToast?.('已验收通过')
  }

  const updateRunChecklist = async (todo, checklist) => {
    if (!todo?.lastRunId) return null
    const run = await updateTodoRun(todo.lastRunId, { checklist })
    setRunCache(todo.id, run)
    return run
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

  const cancelQueuedTodo = async (todo) => {
    if (!todo?.id) return
    const id = String(todo.id)
    queueIds.value = queueIds.value.filter((qid) => String(qid) !== id)
    const nextStartOptions = { ...startOptionsByTodoId.value }
    delete nextStartOptions[id]
    startOptionsByTodoId.value = nextStartOptions
    if (todo.runStatus === TODO_RUN_STATUS.QUEUED) {
      await applyTodoPatch(todo.id, { runStatus: TODO_RUN_STATUS.IDLE })
      onToast?.('已取消排队')
    }
  }

  const stopTodo = async (todo) => {
    if (!todo?.id) return
    const status = normalizeTodoRunStatus(todo.runStatus)
    if (status === TODO_RUN_STATUS.QUEUED) {
      await cancelQueuedTodo(todo)
      return
    }
    if (status === TODO_RUN_STATUS.RUNNING) {
      if (String(activeTodoId.value) === String(todo.id)) {
        await cancelActive()
      } else {
        await applyTodoPatch(todo.id, { runStatus: TODO_RUN_STATUS.IDLE })
        onToast?.('已停止')
      }
    }
  }

  const cancelActive = async ({ notify = true } = {}) => {
    const todoId = activeTodoId.value
    const runId = activeRunId.value
    if (!todoId) return
    endPoll()
    try {
      if (runId) {
        const run = await fetchTodoRun(runId)
        if (run?.bridgeRunId) await agentCancelRun(run.bridgeRunId)
        await finalizeCancelledRun(todoId, runId, { notify })
      } else {
        await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.IDLE }).catch(() => {})
        if (notify) onToast?.('已取消执行')
      }
    } catch (error) {
      onError?.(error)
    } finally {
      activeTodoId.value = null
      activeRunId.value = null
      void pump()
    }
  }

  const cancelOnLeave = async ({ notify = false } = {}) => {
    const queuedIds = [...queueIds.value]
    queueIds.value = []
    for (const id of queuedIds) {
      const nextStartOptions = { ...startOptionsByTodoId.value }
      delete nextStartOptions[String(id)]
      startOptionsByTodoId.value = nextStartOptions
      await applyTodoPatch(id, { runStatus: TODO_RUN_STATUS.IDLE }).catch(() => {})
    }
    const todoId = activeTodoId.value
    const runId = activeRunId.value
    endPoll()
    try {
      if (todoId && runId) {
        const run = await fetchTodoRun(runId)
        if (run?.bridgeRunId) await agentCancelRun(run.bridgeRunId).catch(() => {})
        await finalizeCancelledRun(todoId, runId, { notify })
      } else if (todoId) {
        await applyTodoPatch(todoId, { runStatus: TODO_RUN_STATUS.IDLE }).catch(() => {})
      }
    } catch (error) {
      if (notify) onError?.(error)
    } finally {
      activeTodoId.value = null
      activeRunId.value = null
    }
  }

  const cancelAll = async () => {
    await cancelOnLeave({ notify: false })
    onToast?.('已停止全部任务')
  }

  const loadRunForTodo = async (todo) => {
    if (!todo?.id) return null
    return refreshRunHistory(todo.id)
  }

  /** 预加载事情下各待办执行指标（含 history，供统计图按日汇总） */
  const preloadRunsForProject = async (projectId) => {
    const pid = String(projectId || '').trim()
    if (!pid) return
    try {
      const runs = await fetchTodoRunsByProject(pid, { limit: 200 })
      const runsByTodo = new Map()
      for (const run of runs || []) {
        const tid = String(run?.todoId || '').trim()
        if (!tid) continue
        if (!runsByTodo.has(tid)) runsByTodo.set(tid, [])
        runsByTodo.get(tid).push(run)
      }
      if (!runsByTodo.size) return

      const next = { ...runByTodoId.value }
      for (const [tid, todoRuns] of runsByTodo.entries()) {
        const prev = next[tid]
        if (Array.isArray(prev?.history) && prev.history.length > todoRuns.length) continue

        const latest = todoRuns[0]
        const mergedLatest =
          prev?.id === latest.id
            ? { ...latest, ...prev, id: latest.id, history: undefined }
            : latest

        next[tid] = {
          ...mergedLatest,
          history: todoRuns.map((item) =>
            item.id === mergedLatest.id ? { ...item, ...mergedLatest } : item,
          ),
        }
      }
      runByTodoId.value = next
    } catch {
      /* ignore preload errors */
    }
  }

  const loadDiffForTodo = async (todo, file = null) => {
    const project = getProject?.()
    if (!project?.localPath) throw new Error('未关联本地项目路径')
    const run = (await loadRunForTodo(todo)) || {}
    return agentGitDiff({
      cwd: project.localPath,
      baseRef: run.baseRef || null,
      file,
    })
  }

  const triggerCancelOnLeave = () => {
    void cancelOnLeave()
  }

  onMounted(() => {
    void ensureOrphanRunsReset({ patchTodoLocal, onToast })
    window.addEventListener('beforeunload', triggerCancelOnLeave)
    window.addEventListener('lanbitou:plugin-out', triggerCancelOnLeave)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', triggerCancelOnLeave)
    window.removeEventListener('lanbitou:plugin-out', triggerCancelOnLeave)
    void cancelOnLeave()
  })

  return {
    queueIds,
    continueQueuedTodoIds,
    queueLength,
    runControlActive,
    activeTodoId,
    runningTitle,
    runByTodoId,
    enqueue,
    continueTodo,
    updateQueuedContinueFeedback,
    acceptTodo,
    updateRunChecklist,
    rejectTodo,
    dismissFailed,
    cancelQueuedTodo,
    stopTodo,
    cancelActive,
    cancelAll,
    cancelOnLeave,
    loadRunForTodo,
    preloadRunsForProject,
    loadDiffForTodo,
    syncArchiveMeta: () => syncArchiveMeta(getProject?.()),
    ensureOrphanRunsReset: () => ensureOrphanRunsReset({ patchTodoLocal, onToast }),
    statusLabel: TODO_RUN_STATUS_LABEL,
  }
}
