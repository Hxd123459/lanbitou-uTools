import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildUserContent } from './todoCopyUserContent.js'

describe('buildUserContent', () => {
  it('writes full display status for each todo', () => {
    const content = buildUserContent(
      { name: '测试项目' },
      [
        { id: 1, title: '已验收项', done: true },
        { id: 2, title: '未完成项', done: false, runStatus: 'idle' },
        { id: 3, title: '进行中项', done: false, runStatus: 'running' },
        { id: 4, title: '待验收项', done: false, runStatus: 'pending_review' },
      ],
    )

    assert.match(content, /状态: 已验收/)
    assert.match(content, /状态: 未完成/)
    assert.match(content, /状态: 进行中/)
    assert.match(content, /状态: 待验收/)
    assert.doesNotMatch(content, /状态: 已完成/)
  })
})
