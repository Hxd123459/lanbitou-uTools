import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { TEMPLATES } from './todoCopyTemplates.js'

const STATUS_CATEGORIZE_HINT = /按状态归类|不得跨状态混写/

describe('TEMPLATES system prompts', () => {
  it('daily requires status-based sections', () => {
    const { system } = TEMPLATES.daily
    assert.match(system, STATUS_CATEGORIZE_HINT)
    assert.match(system, /状态「已验收」→ ## 今日完成/)
    assert.match(system, /状态「进行中」→ ## 进行中/)
    assert.match(system, /状态「待验收」→ ## 待验收/)
    assert.match(system, /状态「失败」→ ## 风险或阻塞/)
  })

  it('release requires status-based sections', () => {
    const { system } = TEMPLATES.release
    assert.match(system, STATUS_CATEGORIZE_HINT)
    assert.match(system, /状态「已验收」→ ### 已验收/)
    assert.match(system, /状态「待验收」→ ### 待验收/)
    assert.match(system, /状态「进行中」→ ### 进行中/)
  })

  it('retro requires status-based sections', () => {
    const { system } = TEMPLATES.retro
    assert.match(system, STATUS_CATEGORIZE_HINT)
    assert.match(system, /状态「已验收」→ ## 已验收/)
    assert.match(system, /状态「失败」→ ## 失败/)
    assert.match(system, /状态「未完成」→ ## 未完成/)
  })
})
