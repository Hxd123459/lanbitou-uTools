import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  STATS_CHART_DAYS,
  aggregateProjectMetricsByDay,
  getTodoMetrics,
} from './todoRunMetrics.js'

/** 本地时区构造时间戳，与 aggregateProjectMetricsByDay 的 dateKey 逻辑一致 */
function localMs(year, month, day, hour = 12, minute = 0, second = 0) {
  return new Date(year, month - 1, day, hour, minute, second).getTime()
}

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function makeRun({ id, startedAt, finishedAt, usage, status }) {
  return {
    id,
    startedAt,
    ...(finishedAt != null ? { finishedAt } : {}),
    ...(status ? { status } : {}),
    usage: usage ?? { totalTokens: 0 },
  }
}

describe('aggregateProjectMetricsByDay', () => {
  it('returns exactly 15 consecutive calendar days ending at nowMs midnight', () => {
    const nowMs = localMs(2026, 7, 30, 18, 30)
    const result = aggregateProjectMetricsByDay([], {}, STATS_CHART_DAYS, nowMs)

    assert.equal(result.length, 15)
    assert.equal(result[0].dateKey, dateKey(2026, 7, 16))
    assert.equal(result[14].dateKey, dateKey(2026, 7, 30))
    for (const item of result) {
      assert.equal(item.totalTokens, 0)
      assert.equal(item.totalDurationMs, 0)
    }
  })

  it('excludes runs outside the window and accumulates same-day runs', () => {
    const nowMs = localMs(2026, 7, 30, 10, 0)
    const todos = [{ id: 'todo-1' }]
    const runDetails = {
      'todo-1': {
        id: 'run-current',
        startedAt: '2026-07-30 09:00:00',
        finishedAt: '2026-07-30 09:30:00',
        usage: { totalTokens: 100 },
        history: [
          makeRun({
            id: 'run-a',
            startedAt: '2026-07-30 08:00:00',
            finishedAt: '2026-07-30 08:10:00',
            usage: { totalTokens: 50 },
          }),
          makeRun({
            id: 'run-old',
            startedAt: '2026-07-15 12:00:00',
            finishedAt: '2026-07-15 12:05:00',
            usage: { totalTokens: 999 },
          }),
        ],
      },
    }

    const result = aggregateProjectMetricsByDay(todos, runDetails, 15, nowMs)
    const day30 = result.find((item) => item.dateKey === dateKey(2026, 7, 30))
    const day16 = result.find((item) => item.dateKey === dateKey(2026, 7, 16))

    assert.equal(day30.totalTokens, 150)
    assert.equal(day30.totalDurationMs, 40 * 60 * 1000)
    assert.equal(day16.totalTokens, 0)
    assert.equal(day16.totalDurationMs, 0)
    assert.ok(!result.some((item) => item.totalTokens === 999))
  })

  it('deduplicates runs shared between history and current detail', () => {
    const nowMs = localMs(2026, 7, 28, 12, 0)
    const sharedRun = makeRun({
      id: 'run-dup',
      startedAt: '2026-07-28 10:00:00',
      finishedAt: '2026-07-28 10:20:00',
      usage: { totalTokens: 200 },
    })
    const todos = [{ id: 'todo-1' }]
    const runDetails = {
      'todo-1': {
        ...sharedRun,
        history: [sharedRun],
      },
    }

    const result = aggregateProjectMetricsByDay(todos, runDetails, 15, nowMs)
    const day28 = result.find((item) => item.dateKey === dateKey(2026, 7, 28))

    assert.equal(day28.totalTokens, 200)
    assert.equal(day28.totalDurationMs, 20 * 60 * 1000)
  })

  it('fills zero-value buckets for days without runs', () => {
    const nowMs = localMs(2026, 7, 20, 9, 0)
    const todos = [{ id: 'todo-1' }]
    const runDetails = {
      'todo-1': makeRun({
        id: 'run-only',
        startedAt: '2026-07-20 08:00:00',
        finishedAt: '2026-07-20 08:05:00',
        usage: { totalTokens: 10 },
      }),
    }

    const result = aggregateProjectMetricsByDay(todos, runDetails, 15, nowMs)
    const emptyDay = result.find((item) => item.dateKey === dateKey(2026, 7, 19))
    const activeDay = result.find((item) => item.dateKey === dateKey(2026, 7, 20))

    assert.equal(emptyDay.totalTokens, 0)
    assert.equal(emptyDay.totalDurationMs, 0)
    assert.equal(activeDay.totalTokens, 10)
    assert.equal(activeDay.totalDurationMs, 5 * 60 * 1000)
  })

  it('uses nowMs for live running run duration', () => {
    const startMs = localMs(2026, 7, 25, 10, 0)
    const todos = [{ id: 'todo-1', runStatus: 'running', lastRunId: 'run-live' }]
    const runDetails = {
      'todo-1': makeRun({
        id: 'run-live',
        startedAt: '2026-07-25 10:00:00',
        status: 'running',
        usage: { totalTokens: 30 },
      }),
    }

    const now1 = startMs + 5 * 60 * 1000
    const now2 = startMs + 12 * 60 * 1000
    const day1 = aggregateProjectMetricsByDay(todos, runDetails, 15, now1).find(
      (item) => item.dateKey === dateKey(2026, 7, 25),
    )
    const day2 = aggregateProjectMetricsByDay(todos, runDetails, 15, now2).find(
      (item) => item.dateKey === dateKey(2026, 7, 25),
    )

    assert.equal(day1.totalDurationMs, 5 * 60 * 1000)
    assert.equal(day2.totalDurationMs, 12 * 60 * 1000)
    assert.equal(day1.totalTokens, 30)
    assert.equal(day2.totalTokens, 30)
  })
})

describe('getTodoMetrics', () => {
  it('sums tokens and duration across all history runs', () => {
    const nowMs = localMs(2026, 7, 30, 12, 0)
    const todo = { id: 'todo-1' }
    const runDetail = {
      id: 'run-latest',
      startedAt: '2026-07-30 10:00:00',
      finishedAt: '2026-07-30 10:10:00',
      usage: { totalTokens: 100 },
      history: [
        makeRun({
          id: 'run-latest',
          startedAt: '2026-07-30 10:00:00',
          finishedAt: '2026-07-30 10:10:00',
          usage: { totalTokens: 100 },
        }),
        makeRun({
          id: 'run-old',
          startedAt: '2026-07-28 09:00:00',
          finishedAt: '2026-07-28 09:20:00',
          usage: { inputTokens: 30, outputTokens: 50, cacheReadTokens: 20 },
        }),
      ],
    }

    const metrics = getTodoMetrics(todo, runDetail, nowMs)

    assert.equal(metrics.totalTokens, 200)
    assert.equal(metrics.totalDurationMs, (10 + 20) * 60 * 1000)
  })

  it('aligns with chart totals when runs fall inside the window', () => {
    const nowMs = localMs(2026, 7, 30, 12, 0)
    const todos = [{ id: 'todo-1' }, { id: 'todo-2' }]
    const runDetails = {
      'todo-1': {
        id: 'run-1',
        startedAt: '2026-07-29 10:00:00',
        finishedAt: '2026-07-29 10:05:00',
        usage: { totalTokens: 40 },
        history: [
          makeRun({
            id: 'run-1',
            startedAt: '2026-07-29 10:00:00',
            finishedAt: '2026-07-29 10:05:00',
            usage: { totalTokens: 40 },
          }),
        ],
      },
      'todo-2': {
        id: 'run-2',
        startedAt: '2026-07-30 08:00:00',
        finishedAt: '2026-07-30 08:10:00',
        usage: { totalTokens: 60 },
        history: [
          makeRun({
            id: 'run-2',
            startedAt: '2026-07-30 08:00:00',
            finishedAt: '2026-07-30 08:10:00',
            usage: { totalTokens: 60 },
          }),
        ],
      },
    }

    const chartTotal = aggregateProjectMetricsByDay(todos, runDetails, 15, nowMs).reduce(
      (sum, item) => sum + item.totalTokens,
      0,
    )
    const metricsTotal = todos.reduce((sum, todo) => {
      const detail = runDetails[String(todo.id)]
      return sum + getTodoMetrics(todo, detail, nowMs).totalTokens
    }, 0)

    assert.equal(chartTotal, 100)
    assert.equal(metricsTotal, chartTotal)
  })
})
