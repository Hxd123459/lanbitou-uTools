import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pinRunningTodosFirst } from './todoSort.js'

describe('pinRunningTodosFirst', () => {
  it('returns empty array for non-array input', () => {
    assert.deepEqual(pinRunningTodosFirst(null), [])
  })

  it('keeps original order', () => {
    const list = [
      { id: 'a', done: false },
      { id: 'b', done: true },
      { id: 'c', done: false },
    ]
    assert.deepEqual(pinRunningTodosFirst(list), list)
  })
})
