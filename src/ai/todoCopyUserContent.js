import {
  getTodoDisplayStatus,
  TODO_DISPLAY_STATUS_LABEL,
} from '../constants/todoRunStatus.js'

export function buildUserContent(project, todos, runsById = {}) {
  const blocks = todos.map((todo, i) => {
    const run = runsById[String(todo.id)] || null
    const { key } = getTodoDisplayStatus(todo)
    const statusText = TODO_DISPLAY_STATUS_LABEL[key] || '未完成'
    return [
      `${i + 1}. ${todo.title}`,
      `状态: ${statusText}`,
      run?.summary ? `摘要: ${String(run.summary).slice(0, 400)}` : '',
      run?.reviewNote ? `验收备注: ${run.reviewNote}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  })
  return [
    `事情：${project?.name || ''}`,
    project?.purpose ? `初衷：${project.purpose}` : '',
    '',
    '待办：',
    blocks.join('\n\n'),
  ]
    .filter(Boolean)
    .join('\n')
}
