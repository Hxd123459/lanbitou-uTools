import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { patchQueuedContinueFeedback } from './todoRunQueueFeedback.js'

describe('patchQueuedContinueFeedback', () => {
  const continueOpts = {
    mode: 'resume',
    agentId: 'agent-1',
    feedback: '旧反馈',
    prevRun: { summary: '摘要', changedFiles: ['a.js'] },
  }

  it('updates feedback while preserving other start options', () => {
    const next = patchQueuedContinueFeedback({ t1: continueOpts }, 't1', '  新反馈  ')
    assert.equal(next.t1.feedback, '新反馈')
    assert.equal(next.t1.mode, 'resume')
    assert.equal(next.t1.agentId, 'agent-1')
    assert.deepEqual(next.t1.prevRun, continueOpts.prevRun)
  })

  it('returns null for non-continue enqueue options', () => {
    assert.equal(patchQueuedContinueFeedback({ t1: {} }, 't1', 'x'), null)
    assert.equal(patchQueuedContinueFeedback({}, 't1', 'x'), null)
    assert.equal(patchQueuedContinueFeedback({ t1: continueOpts }, '', 'x'), null)
  })
})
