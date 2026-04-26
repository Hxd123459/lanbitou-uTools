import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const DAY_MS = 24 * 60 * 60 * 1000

function formatDateLabel(date) {
  const today = new Date()
  const d = new Date(date)
  const dayDelta = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
      new Date(d.getFullYear(), d.getMonth(), d.getDate())) /
      DAY_MS,
  )

  if (dayDelta === 0) return '今天'
  if (dayDelta === 1) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function formatDateKey(date) {
  const d = new Date(date)
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export const useAssistantStore = defineStore('assistant', () => {
  const notes = ref([
    {
      id: 'n1',
      text: '今天先把产品首页骨架搭好，重点保证输入体验。',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'n2',
      text: '昨天梳理了视觉风格，主色和卡片层级已明确。',
      createdAt: new Date(Date.now() - DAY_MS).toISOString(),
    },
  ])

  const groupedNotes = computed(() => {
    const map = new Map()
    notes.value.forEach((note) => {
      const key = formatDateKey(note.createdAt)
      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          label: formatDateLabel(note.createdAt),
          items: [],
        })
      }
      map.get(key).items.push(note)
    })

    return Array.from(map.values()).sort((a, b) =>
      a.dateKey > b.dateKey ? -1 : 1,
    )
  })

  const addNote = (text) => {
    notes.value.unshift({
      id: `n_${Date.now()}`,
      text,
      createdAt: new Date().toISOString(),
    })
  }

  const qaRecords = ref([
    {
      id: 'qa1',
      question: '今天重点做什么？',
      answer: '今天重点是先完成首页布局与输入交互，保证记录体验顺畅。',
      createdAt: new Date().toISOString(),
    },
  ])

  const createAnswerFromNotes = (question) => {
    if (!notes.value.length) {
      return '我还没有可参考的笔记内容，你可以先记录一些信息再来提问。'
    }
    const latestNotes = notes.value.slice(0, 3).map((item) => `- ${item.text}`)
    return `结合你最近的笔记，我给你的回答是：\n${latestNotes.join('\n')}\n\n问题：${question}`
  }

  const addQARecord = (question) => {
    const answer = createAnswerFromNotes(question)
    qaRecords.value.unshift({
      id: `qa_${Date.now()}`,
      question,
      answer,
      createdAt: new Date().toISOString(),
    })
  }

  return {
    notes,
    groupedNotes,
    qaRecords,
    addNote,
    addQARecord,
  }
})
