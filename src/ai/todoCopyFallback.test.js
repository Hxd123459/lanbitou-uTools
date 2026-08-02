import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fallbackGenerate } from './todoCopyFallback.js'

const mixedTodos = [
  { id: 1, title: '已完成项', done: true },
  { id: 2, title: '未完成项', done: false },
]

describe('fallbackGenerate', () => {
  it('groups daily copy by done status', () => {
    const text = fallbackGenerate('daily', { name: '测试项目' }, mixedTodos)

    assert.match(text, /## 今日完成/)
    assert.match(text, /已完成项（已完成）/)
    assert.match(text, /## 未完成/)
    assert.match(text, /未完成项（未完成）/)
    assert.doesNotMatch(text, /### 更新/)
  })

  it('groups release copy with status sections', () => {
    const text = fallbackGenerate('release', { name: '测试项目' }, mixedTodos)

    assert.match(text, /### 已完成/)
    assert.match(text, /### 未完成/)
    assert.doesNotMatch(text, /## 今日完成/)
  })

  it('groups retro copy by done status', () => {
    const text = fallbackGenerate('retro', { name: '测试项目' }, mixedTodos)

    assert.match(text, /## 已完成/)
    assert.match(text, /## 未完成/)
  })
})
