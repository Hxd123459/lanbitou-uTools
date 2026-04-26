import { onBeforeUnmount, ref } from 'vue'
import { createChatStream } from '../api/chat'

export function useChatStream() {
  const answer = ref('')
  const loading = ref(false)
  const errorMessage = ref('')
  let stream = null

  const startStream = (question, callbacks = {}) => {
    stopStream()
    answer.value = ''
    errorMessage.value = ''
    loading.value = true

    try {
      stream = createChatStream(question, {
        onMessage: (chunk) => {
          answer.value += chunk
          callbacks.onChunk?.(chunk, answer.value)
        },
        onEnd: () => {
          loading.value = false
          stream = null
          callbacks.onEnd?.(answer.value)
        },
        onError: (error) => {
          loading.value = false
          stream = null
          errorMessage.value = error?.message || '流式请求异常'
          callbacks.onError?.(error)
        },
      })
    } catch (error) {
      loading.value = false
      errorMessage.value = error?.message || '流式请求异常'
      callbacks.onError?.(error)
    }
  }

  const stopStream = () => {
    if (stream) {
      stream.close()
      stream = null
    }
    loading.value = false
  }

  onBeforeUnmount(() => {
    stopStream()
  })

  return {
    answer,
    loading,
    errorMessage,
    startStream,
    stopStream,
  }
}
