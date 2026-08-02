const STATUS_LABEL = {
  done: '已完成',
  idle: '未完成',
}

function todoDisplayKey(todo) {
  return todo?.done ? 'done' : 'idle'
}

export function buildUserContent(project, todos) {
  const blocks = todos.map((todo, i) => {
    const key = todoDisplayKey(todo)
    const statusText = STATUS_LABEL[key] || '未完成'
    return [
      `${i + 1}. ${todo.title}`,
      `状态: ${statusText}`,
    ].join('\n')
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
