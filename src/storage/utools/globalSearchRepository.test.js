import assert from 'node:assert/strict'
import { after, describe, it, mock } from 'node:test'

import { PROJECT_PREFIX, TODO_PREFIX } from './constants.js'

const projectDoc = {
  _id: `${PROJECT_PREFIX}proj-1`,
  id: 'proj-1',
  name: '测试项目',
  tagIds: [],
  createTime: '2026-01-01 10:00:00',
}

const todoDoc = {
  _id: `${TODO_PREFIX}todo-1`,
  id: 'todo-1',
  projectId: 'proj-1',
  title: '实现登录页',
  doneWhen: '页面可正常登录',
  sourceExcerpt: '来自笔记摘录',
  sourceNoteTitle: '产品需求',
  createTime: '2026-01-02 10:00:00',
}

mock.module('../../constants/uploadLimits.js', {
  exports: { isImageMimeType: () => false },
})
mock.module('../../utils/attachmentMarkdown.js', {
  exports: { LB_ATT_SCHEME: 'lb-att://' },
})
mock.module('../../utils/searchHighlight.js', {
  exports: {
    extractMatchSnippets: (text) => (text ? [String(text).slice(0, 120)] : []),
    plainTextForSnippet: (text) => String(text ?? ''),
  },
})
mock.module('./attachment.js', {
  exports: {
    imagesToBlocks: () => [],
    getAttachmentBlobUrl: () => '',
  },
})
mock.module('./utils.js', {
  exports: {
    datePartFromDateTime: (value) => String(value ?? '').slice(0, 10),
  },
})
mock.module('./dbClient.js', {
  exports: {
    dbAllDocs: async (prefix) => {
      if (prefix === TODO_PREFIX) return [todoDoc]
      if (prefix === PROJECT_PREFIX) return [projectDoc]
      return []
    },
    dbGetAttachmentType: () => null,
  },
})
mock.module('./tagRepository.js', {
  exports: {
    listTagDocs: async () => [],
  },
})

const { globalSearch } = await import('./globalSearchRepository.js')

describe('globalSearch todo scope', () => {
  after(() => {
    mock.reset()
  })

  it('returns type=todo paginated records when keyword matches todo fields', async () => {
    const byTitle = await globalSearch({
      keywords: ['登录'],
      scopes: ['todo'],
      page: 1,
      pageSize: 10,
    })
    assert.equal(byTitle.total, 1)
    assert.equal(byTitle.records[0].type, 'todo')
    assert.equal(byTitle.records[0].todoId, 'todo-1')
    assert.equal(byTitle.pageNo, 1)
    assert.equal(byTitle.pageSize, 10)

    const byDoneWhen = await globalSearch({
      keywords: ['正常登录'],
      scopes: ['todo'],
      page: 1,
      pageSize: 10,
    })
    assert.equal(byDoneWhen.total, 1)
    assert.equal(byDoneWhen.records[0].type, 'todo')

    const bySourceTitle = await globalSearch({
      keywords: ['产品需求'],
      scopes: ['todo'],
      page: 1,
      pageSize: 10,
    })
    assert.equal(bySourceTitle.total, 1)
    assert.equal(bySourceTitle.records[0].type, 'todo')

    const bySourceExcerpt = await globalSearch({
      keywords: ['笔记摘录'],
      scopes: ['todo'],
      page: 1,
      pageSize: 10,
    })
    assert.equal(bySourceExcerpt.total, 1)
    assert.equal(bySourceExcerpt.records[0].type, 'todo')

    const excluded = await globalSearch({
      keywords: ['登录'],
      scopes: ['fragment'],
      page: 1,
      pageSize: 10,
    })
    assert.equal(excluded.total, 0)
  })
})
