import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizeBackupSortOrder,
  resolveBackupSortOrder,
  mapTodoRunForBackup,
  TODO_RUNS_BACKUP_FILE,
} from './format.js'

describe('normalizeBackupSortOrder', () => {
  it('keeps finite numbers including negatives', () => {
    assert.equal(normalizeBackupSortOrder(2), 2)
    assert.equal(normalizeBackupSortOrder(-1), -1)
    assert.equal(normalizeBackupSortOrder('3'), 3)
  })

  it('falls back when value is not a finite number', () => {
    assert.equal(normalizeBackupSortOrder(null, 5), 5)
    assert.equal(normalizeBackupSortOrder(undefined, 0), 0)
    assert.equal(normalizeBackupSortOrder('abc', 7), 7)
  })
})

describe('resolveBackupSortOrder', () => {
  it('uses incoming sortOrder when present', () => {
    assert.equal(resolveBackupSortOrder({ sortOrder: 4 }, 1), 4)
    assert.equal(resolveBackupSortOrder({ sortOrder: 0 }, 9), 0)
  })

  it('keeps existing sortOrder for legacy backups without the field', () => {
    assert.equal(resolveBackupSortOrder({ id: 'p1' }, 6), 6)
  })

  it('defaults to zero when neither incoming nor existing has sortOrder', () => {
    assert.equal(resolveBackupSortOrder({ id: 'p1' }), 0)
  })
})

describe('mapTodoRunForBackup', () => {
  it('maps run fields for todoRuns.json export', () => {
    const mapped = mapTodoRunForBackup({
      id: 'run-1',
      todoId: 'todo-1',
      projectId: 'proj-1',
      status: 'finished',
      summary: 'done',
      lastRunId: 'ignored',
      changedFiles: ['a.js'],
      createTime: '2026-01-01 10:00:00',
      updateTime: '2026-01-01 11:00:00',
    })
    assert.equal(mapped.id, 'run-1')
    assert.equal(mapped.todoId, 'todo-1')
    assert.equal(mapped.projectId, 'proj-1')
    assert.equal(mapped.status, 'finished')
    assert.deepEqual(mapped.changedFiles, ['a.js'])
    assert.equal(mapped.provider, 'cursor')
    assert.equal(Object.hasOwn(mapped, 'lastRunId'), false)
  })
})

describe('TODO_RUNS_BACKUP_FILE', () => {
  it('uses todoRuns.json as backup entry name', () => {
    assert.equal(TODO_RUNS_BACKUP_FILE, 'todoRuns.json')
  })
})
