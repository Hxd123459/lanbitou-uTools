import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  shouldSkipPollTick,
  wasRunSessionCancelled,
} from './todoRunQueueCancel.js'

describe('wasRunSessionCancelled', () => {
  it('returns true when activeTodoId was cleared', () => {
    assert.equal(wasRunSessionCancelled(null, 'todo-a'), true)
    assert.equal(wasRunSessionCancelled('', 'todo-a'), true)
  })

  it('returns true when active todo differs', () => {
    assert.equal(wasRunSessionCancelled('todo-a', 'todo-b'), true)
  })

  it('returns false while the same todo is still active', () => {
    assert.equal(wasRunSessionCancelled('todo-a', 'todo-a'), false)
    assert.equal(wasRunSessionCancelled(42, '42'), false)
  })
})

describe('shouldSkipPollTick', () => {
  it('returns true after endPoll clears releasePoll', () => {
    assert.equal(shouldSkipPollTick(null), true)
  })

  it('returns false while poll session is active', () => {
    assert.equal(shouldSkipPollTick(() => {}), false)
  })
})
