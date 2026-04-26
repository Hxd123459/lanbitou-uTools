import { onBeforeUnmount, ref } from 'vue'

export function useCopyNote() {
  const showToast = ref(false)
  const toastText = ref('复制成功')
  const toastType = ref('success')
  let timer = null

  const closeToast = () => {
    showToast.value = false
  }

  const openToast = (text = '复制成功', type = 'success') => {
    toastText.value = text
    toastType.value = type
    showToast.value = true
    if (timer) clearTimeout(timer)
    timer = window.setTimeout(() => {
      showToast.value = false
    }, 1200)
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
    if (timer) clearTimeout(timer)
  })

  return {
    showToast,
    toastText,
    toastType,
    closeToast,
    openToast,
    copyText,
  }
}
