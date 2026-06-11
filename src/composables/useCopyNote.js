import { onBeforeUnmount, ref } from 'vue'

export function useCopyNote() {
  const showToast = ref(false)
  const toastText = ref('复制成功')
  const toastType = ref('success')
  const toastActionLabel = ref('')
  /** @type {import('vue').Ref<'auto' | 'manual'>} */
  const toastDismissMode = ref('auto')
  let toastActionHandler = null
  let timer = null

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const closeToast = () => {
    clearTimer()
    showToast.value = false
    toastActionLabel.value = ''
    toastActionHandler = null
    toastDismissMode.value = 'auto'
  }

  /**
   * options: {
   *   duration?: number,
   *   actionLabel?: string,
   *   onAction?: Function,
   *   dismissMode?: 'auto' | 'manual',
   * }
   */
  const openToast = (text = '复制成功', type = 'success', options = {}) => {
    const {
      duration = 2000,
      actionLabel = '',
      onAction = null,
      dismissMode = 'auto',
    } = options
    toastText.value = text
    toastType.value = type
    toastActionLabel.value = actionLabel
    toastDismissMode.value = dismissMode
    toastActionHandler = onAction
    showToast.value = true

    clearTimer()
    if (dismissMode === 'manual') return
    if (duration > 0) {
      timer = window.setTimeout(() => {
        closeToast()
      }, duration)
    }
  }

  const triggerToastAction = () => {
    const handler = toastActionHandler
    closeToast()
    if (typeof handler === 'function') handler()
  }

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      openToast('复制成功')
      return true
    } catch {
      openToast('复制失败', 'error')
      return false
    }
  }

  onBeforeUnmount(() => {
    clearTimer()
  })

  return {
    showToast,
    toastText,
    toastType,
    toastActionLabel,
    toastDismissMode,
    closeToast,
    openToast,
    triggerToastAction,
    copyText,
  }
}
