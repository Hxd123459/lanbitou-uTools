import { onBeforeUnmount, onMounted, ref } from 'vue'

const MODES = ['note', 'ask']

export function useTabMode(initialMode = 'note') {
  const mode = ref(MODES.includes(initialMode) ? initialMode : 'note')

  const setMode = (nextMode) => {
    if (!MODES.includes(nextMode)) return
    mode.value = nextMode
  }

  const toggleMode = () => {
    mode.value = mode.value === 'note' ? 'ask' : 'note'
  }

  const onKeyDown = (event) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    toggleMode()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
  })

  return {
    mode,
    setMode,
    toggleMode,
  }
}
