import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { shouldPumpAfterEnqueue } from './todoRunQueueEnqueue.js'

describe('shouldPumpAfterEnqueue', () => {
  it('returns false when a task is executing', () => {
    assert.equal(shouldPumpAfterEnqueue('todo-a'), false)
  })

  it('returns true when no active task', () => {
    assert.equal(shouldPumpAfterEnqueue(null), true)
    assert.equal(shouldPumpAfterEnqueue(undefined), true)
    assert.equal(shouldPumpAfterEnqueue(''), true)
  })
})
