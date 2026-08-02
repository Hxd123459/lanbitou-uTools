import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildUserContent } from './todoCopyUserContent.js'

describe('buildUserContent', () => {
  it('writes done/undone status for each todo', () => {
    const content = buildUserContent(
      { name: '测试项目' },
      [
        { id: 1, title: '已完成项', done: true },
        { id: 2, title: '未完成项', done: false },
      ],
    )

    assert.match(content, /状态: 已完成/)
    assert.match(content, /状态: 未完成/)
    assert.doesNotMatch(content, /状态: 已验收/)
    assert.doesNotMatch(content, /状态: 进行中/)
  })
})
