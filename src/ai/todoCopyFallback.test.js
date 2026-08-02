import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fallbackGenerate } from './todoCopyFallback.js'

const mixedTodos = [
  { id: 1, title: '已验收项', done: true },
  { id: 2, title: '未完成项', done: false, runStatus: 'idle' },
  { id: 3, title: '进行中项', done: false, runStatus: 'running' },
  { id: 4, title: '待验收项', done: false, runStatus: 'pending_review' },
]

describe('fallbackGenerate', () => {
  it('groups daily copy by display status', () => {
    const text = fallbackGenerate('daily', { name: '测试项目' }, mixedTodos)

    assert.match(text, /## 今日完成/)
    assert.match(text, /已验收项（已验收）/)
    assert.match(text, /## 待验收/)
    assert.match(text, /待验收项（待验收）/)
    assert.match(text, /## 进行中/)
    assert.match(text, /进行中项/)
    assert.match(text, /## 未完成/)
    assert.match(text, /未完成项（未完成）/)
    assert.doesNotMatch(text, /### 更新/)
  })

  it('groups release copy with status sections', () => {
    const text = fallbackGenerate('release', { name: '测试项目' }, mixedTodos)

    assert.match(text, /### 已验收/)
    assert.match(text, /### 待验收/)
    assert.match(text, /### 进行中/)
    assert.match(text, /### 未完成/)
    assert.doesNotMatch(text, /## 今日完成/)
  })

  it('groups retro copy by display status', () => {
    const text = fallbackGenerate('retro', { name: '测试项目' }, mixedTodos)

    assert.match(text, /## 已验收/)
    assert.match(text, /## 待验收/)
    assert.match(text, /## 进行中/)
    assert.match(text, /## 未完成/)
  })
})
