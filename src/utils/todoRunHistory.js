const CONTINUE_PROMPT_MARK = '请根据以下反馈继续修改'
const FEEDBACK_LINE_RE = /^用户反馈：(.+)$/m
const EMPTY_FEEDBACK =
  '（未填写具体说明，请自行检查并完善上一轮结果）'

export const RUN_RECORD_STATUS_LABEL = {
  queued: '排队中',
  running: '进行中',
  finished: '已完成',
  error: '失败',
  cancelled: '已取消',
}

/** 从继续改 prompt 中提取用户反馈摘录 */
export function extractRunFeedbackFromPrompt(prompt) {
  const text = String(prompt || '')
  if (!text.includes(CONTINUE_PROMPT_MARK)) return ''
  const match = text.match(FEEDBACK_LINE_RE)
  if (!match) return ''
  const feedback = String(match[1] || '').trim()
  if (!feedback || feedback === EMPTY_FEEDBACK) return ''
  return feedback.slice(0, 240)
}

export function getRunRecordStatusLabel(status) {
  const key = String(status || '').trim()
  return RUN_RECORD_STATUS_LABEL[key] || key || '未知'
}

function runSortTime(run) {
  return String(run?.startedAt || run?.finishedAt || run?.createTime || '')
}

/** 合并 runDetail 与 history，按时间倒序生成各轮展示数据 */
export function buildRunHistoryRounds(runDetail) {
  if (!runDetail) return []

  const runs = []
  const seen = new Set()
  const addRun = (run) => {
    const id = String(run?.id || '').trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    runs.push(run)
  }

  if (Array.isArray(runDetail.history)) {
    for (const item of runDetail.history) addRun(item)
  }
  addRun(runDetail)

  const sorted = [...runs].sort((a, b) =>
    runSortTime(b).localeCompare(runSortTime(a)),
  )
  const total = sorted.length
  const currentId = String(runDetail.id || '').trim()

  return sorted.map((run, index) => {
    const summary = String(run.summary || '').trim()
    const error = String(run.error || '').trim()
    return {
      id: run.id,
      roundNumber: total - index,
      summary: summary ? summary.slice(0, 240) : '',
      error,
      feedback: extractRunFeedbackFromPrompt(run.prompt),
      status: run.status,
      statusLabel: getRunRecordStatusLabel(run.status),
      isCurrent: String(run.id) === currentId,
    }
  })
}
