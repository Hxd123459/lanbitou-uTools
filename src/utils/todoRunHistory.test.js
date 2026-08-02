import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildRunHistoryRounds,
  extractRunFeedbackFromPrompt,
  getRunRecordStatusLabel,
} from './todoRunHistory.js'

describe('todoRunHistory', () => {
  it('extracts feedback from continue prompt', () => {
    const prompt = [
      '请根据以下反馈继续修改（保留与反馈无关的已有正确改动）。',
      '',
      '原待办：改样式',
      '用户反馈：按钮再小一点',
      '上一轮摘要：已改颜色',
    ].join('\n')
    assert.equal(extractRunFeedbackFromPrompt(prompt), '按钮再小一点')
  })

  it('returns empty feedback for first-run prompt', () => {
    assert.equal(
      extractRunFeedbackFromPrompt('待办：某任务\n请在当前仓库完成该待办'),
      '',
    )
  })

  it('builds rounds newest-first with round numbers', () => {
    const runDetail = {
      id: 'r3',
      status: 'finished',
      summary: '第三轮摘要',
      prompt: '请根据以下反馈继续修改\n用户反馈：再紧凑',
      createTime: '2026-08-01 12:00:00',
      history: [
        {
          id: 'r3',
          status: 'finished',
          summary: '第三轮摘要',
          prompt: '请根据以下反馈继续修改\n用户反馈：再紧凑',
          createTime: '2026-08-01 12:00:00',
        },
        {
          id: 'r2',
          status: 'finished',
          summary: '第二轮摘要',
          prompt: '请根据以下反馈继续修改\n用户反馈：间距太大',
          createTime: '2026-08-01 11:00:00',
        },
        {
          id: 'r1',
          status: 'finished',
          summary: '首轮摘要',
          prompt: '待办：某任务',
          createTime: '2026-08-01 10:00:00',
        },
      ],
    }

    const rounds = buildRunHistoryRounds(runDetail)
    assert.equal(rounds.length, 3)
    assert.equal(rounds[0].roundNumber, 3)
    assert.equal(rounds[0].summary, '第三轮摘要')
    assert.equal(rounds[0].feedback, '再紧凑')
    assert.equal(rounds[0].isCurrent, true)
    assert.equal(rounds[2].roundNumber, 1)
    assert.equal(rounds[2].feedback, '')
    assert.equal(getRunRecordStatusLabel('finished'), '已完成')
  })
})
