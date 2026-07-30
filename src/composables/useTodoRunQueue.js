import { computed, onBeforeUnmount, ref } from 'vue'
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
import { updateTodo } from '../api/todo'
import {
  TODO_RUN_STATUS,
  TODO_RUN_STATUS_LABEL,
} from '../constants/todoRunStatus'
import { formatDateTime } from '../storage/utools/utils'

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
      await syncArchiveMeta(project)

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
        createBranch: !isResume,
        branchName,
      })
      const bridgeRunId = started?.run?.id
      if (!bridgeRunId) throw new Error('桥未返回 run id')

      const agentId = started.run.agentId || (isResume ? startOpts.agentId : null)
      const baseRef = started.run.baseRef || started.baseline?.baseRef || null
      await updateTodoRun(runDoc.id, {
        bridgeRunId,
        agentId,
        baseRef,
        branchName: started.run.branchName || branchName,
      })
      setRunCache(todoId, {
        ...runDoc,
        bridgeRunId,
        agentId,
        baseRef,
        branchName: started.run.branchName || branchName,
      })

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
            checklist: remote.checklist || [],
            usage: remote.usage || null,
            agentId: remote.agentId || null,
            baseRef: remote.baseRef || null,
            branchName: remote.branchName || null,
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

  /** 预加载事情下各待办最近一次执行指标（token / 耗时） */
  const preloadRunsForProject = async (projectId) => {
    const pid = String(projectId || '').trim()
    if (!pid) return
    try {
      const runs = await fetchTodoRunsByProject(pid, { limit: 200 })
      const latestByTodo = new Map()
      for (const run of runs || []) {
        const tid = String(run?.todoId || '').trim()
        if (!tid || latestByTodo.has(tid)) continue
        latestByTodo.set(tid, run)
      }
      if (!latestByTodo.size) return
      const next = { ...runByTodoId.value }
      for (const [tid, run] of latestByTodo.entries()) {
        const prev = next[tid]
        if (prev?.history?.length) continue
        next[tid] = { ...run, history: prev?.history || [run] }
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
    updateRunChecklist,
    rejectTodo,
    dismissFailed,
    cancelActive,
    loadRunForTodo,
    preloadRunsForProject,
    loadDiffForTodo,
    syncArchiveMeta: () => syncArchiveMeta(getProject?.()),
    statusLabel: TODO_RUN_STATUS_LABEL,
  }
}
