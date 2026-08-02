import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { TODO_RUN_STATUS } from '../constants/todoRunStatus.js'
import {
  buildCancelledRunPatch,
  isTerminalRunStatus,
  mapTerminalRunToTodoRunStatus,
} from './todoRunTerminal.js'

describe('todoRunTerminal', () => {
  it('buildCancelledRunPatch sets status and finishedAt', () => {
    assert.deepEqual(buildCancelledRunPatch('2026-08-01 20:00:00'), {
      status: 'cancelled',
      finishedAt: '2026-08-01 20:00:00',
    })
  })

  it('isTerminalRunStatus recognizes terminal bridge statuses', () => {
    assert.equal(isTerminalRunStatus('finished'), true)
    assert.equal(isTerminalRunStatus('cancelled'), true)
    assert.equal(isTerminalRunStatus('error'), true)
    assert.equal(isTerminalRunStatus('running'), false)
  })

  it('mapTerminalRunToTodoRunStatus maps cancelled to idle', () => {
    assert.equal(mapTerminalRunToTodoRunStatus('cancelled'), TODO_RUN_STATUS.IDLE)
    assert.equal(mapTerminalRunToTodoRunStatus('finished'), TODO_RUN_STATUS.PENDING_REVIEW)
    assert.equal(mapTerminalRunToTodoRunStatus('error'), TODO_RUN_STATUS.FAILED)
  })
})
