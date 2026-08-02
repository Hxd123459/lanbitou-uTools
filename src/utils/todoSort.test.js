import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { TODO_RUN_STATUS } from '../constants/todoRunStatus.js'
import { pinRunningTodosFirst } from './todoSort.js'

describe('pinRunningTodosFirst', () => {
  it('returns empty array for non-array input', () => {
    assert.deepEqual(pinRunningTodosFirst(null), [])
  })

  it('keeps order when no running todos', () => {
    const list = [
      { id: 'a', runStatus: TODO_RUN_STATUS.IDLE, sortOrder: 0 },
      { id: 'b', runStatus: TODO_RUN_STATUS.QUEUED, sortOrder: 1 },
    ]
    assert.deepEqual(pinRunningTodosFirst(list), list)
  })

  it('pins running todo to the front', () => {
    const list = [
      { id: 'a', runStatus: TODO_RUN_STATUS.IDLE, sortOrder: 0 },
      { id: 'b', runStatus: TODO_RUN_STATUS.RUNNING, sortOrder: 2 },
      { id: 'c', runStatus: TODO_RUN_STATUS.IDLE, sortOrder: 1 },
    ]
    assert.deepEqual(
      pinRunningTodosFirst(list).map((item) => item.id),
      ['b', 'a', 'c'],
    )
  })

  it('keeps relative order among multiple running todos', () => {
    const list = [
      { id: 'a', runStatus: TODO_RUN_STATUS.IDLE, sortOrder: 0 },
      { id: 'b', runStatus: TODO_RUN_STATUS.RUNNING, sortOrder: 2 },
      { id: 'c', runStatus: TODO_RUN_STATUS.RUNNING, sortOrder: 3 },
      { id: 'd', runStatus: TODO_RUN_STATUS.IDLE, sortOrder: 1 },
    ]
    assert.deepEqual(
      pinRunningTodosFirst(list).map((item) => item.id),
      ['b', 'c', 'a', 'd'],
    )
  })
})
