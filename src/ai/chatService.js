import { isUtoolsMode } from '../storage/env'
import { loadAiSettings } from '../storage/utools/aiSettings'
import { runChatWithNoteTools } from './chatAgent'
import { streamChatFromBackend } from '../api/chat'

/**
 * 发送一条用户消息并获取 AI 回复（支持自动检索笔记）
 * @returns {() => void} 流式模式下返回取消函数，非流式返回空函数
 */
export function sendChatMessage({ history, userMessage, onDelta, onDone, onError }) {
  const text = String(userMessage ?? '').trim()
  if (!text) return () => {}

  if (!isUtoolsMode()) {
    let cancel = () => {}
    cancel = streamChatFromBackend(text, {
      onDelta,
      onDone,
      onError,
    })
    return cancel
  }

  const settings = loadAiSettings()

  ;(async () => {
    try {
      const content = await runChatWithNoteTools(settings, {
        history,
        userMessage: text,
      })
      onDelta?.(content)
      onDone?.()
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('对话失败'))
    }
  })()

  return () => {}
}
