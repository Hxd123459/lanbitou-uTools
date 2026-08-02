import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getTodoDisplayStatus,
  isContinueQueuedStartOptions,
  isOrphanRunStatus,
  normalizeImportedTodoRunStatus,
} from './todoRunStatus.js'

describe('getTodoDisplayStatus', () => {
  it('returns done for accepted todos', () => {
    assert.deepEqual(getTodoDisplayStatus({ done: true, runStatus: 'idle' }), {
      key: 'done',
      text: '已验收',
    })
  })

  it('returns idle for untouched todos', () => {
    assert.deepEqual(getTodoDisplayStatus({ done: false, runStatus: 'idle' }), {
      key: 'idle',
      text: '未完成',
    })
    assert.deepEqual(getTodoDisplayStatus({ done: false }), {
      key: 'idle',
      text: '未完成',
    })
  })

  it('returns queued with empty badge text', () => {
    assert.deepEqual(getTodoDisplayStatus({ done: false, runStatus: 'queued' }), {
      key: 'queued',
      text: '',
    })
  })

  it('returns continue queued badge for continue enqueue', () => {
    assert.deepEqual(
      getTodoDisplayStatus({ done: false, runStatus: 'queued' }, { isContinueQueued: true }),
      {
        key: 'queued_continue',
        text: '继续改·排队中',
      },
    )
  })

  it('returns running with empty badge text', () => {
    assert.deepEqual(getTodoDisplayStatus({ done: false, runStatus: 'running' }), {
      key: 'running',
      text: '',
    })
  })

  it('returns pending_review before done flag', () => {
    assert.deepEqual(getTodoDisplayStatus({ done: false, runStatus: 'pending_review' }), {
      key: 'pending_review',
      text: '待验收',
    })
  })

  it('returns failed for failed runs', () => {
    assert.deepEqual(getTodoDisplayStatus({ done: false, runStatus: 'failed' }), {
      key: 'failed',
      text: '失败',
    })
  })

  it('prefers done over runStatus', () => {
    assert.deepEqual(getTodoDisplayStatus({ done: true, runStatus: 'running' }), {
      key: 'done',
      text: '已验收',
    })
  })
})

describe('isContinueQueuedStartOptions', () => {
  it('detects continueTodo start options', () => {
    assert.equal(isContinueQueuedStartOptions({ feedback: '改紧凑点', prevRun: null }), true)
    assert.equal(isContinueQueuedStartOptions({ feedback: '', prevRun: { summary: 'x' } }), true)
  })

  it('ignores regular enqueue options', () => {
    assert.equal(isContinueQueuedStartOptions({}), false)
    assert.equal(isContinueQueuedStartOptions(null), false)
  })
})

describe('isOrphanRunStatus', () => {
  it('treats running and queued as orphan', () => {
    assert.equal(isOrphanRunStatus('running'), true)
    assert.equal(isOrphanRunStatus('queued'), true)
  })

  it('ignores other statuses', () => {
    assert.equal(isOrphanRunStatus('idle'), false)
    assert.equal(isOrphanRunStatus('pending_review'), false)
    assert.equal(isOrphanRunStatus('failed'), false)
    assert.equal(isOrphanRunStatus(''), false)
  })
})

describe('normalizeImportedTodoRunStatus', () => {
  it('normalizes running and queued to idle', () => {
    assert.equal(normalizeImportedTodoRunStatus('running'), 'idle')
    assert.equal(normalizeImportedTodoRunStatus('queued'), 'idle')
  })

  it('preserves other statuses', () => {
    assert.equal(normalizeImportedTodoRunStatus('idle'), 'idle')
    assert.equal(normalizeImportedTodoRunStatus('pending_review'), 'pending_review')
    assert.equal(normalizeImportedTodoRunStatus('failed'), 'failed')
    assert.equal(normalizeImportedTodoRunStatus(''), 'idle')
  })
})
