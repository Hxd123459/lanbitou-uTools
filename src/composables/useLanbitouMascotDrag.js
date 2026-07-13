import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const POSITION_KEY = 'lanbitou/mascot-position'
const DRAG_THRESHOLD = 4
const BODY_WIDTH = 52
const BODY_HEIGHT = 96

function readSavedPosition() {
  try {
    const raw = localStorage.getItem(POSITION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Number.isFinite(parsed?.left) || !Number.isFinite(parsed?.top)) return null
    return { left: parsed.left, top: parsed.top }
  } catch {
    return null
  }
}

function writeSavedPosition(position) {
  try {
    if (!position) {
      localStorage.removeItem(POSITION_KEY)
      return
    }
    localStorage.setItem(POSITION_KEY, JSON.stringify(position))
  } catch {
    // ignore
  }
}

function clampPosition(left, top) {
  const maxLeft = Math.max(0, window.innerWidth - BODY_WIDTH)
  const maxTop = Math.max(0, window.innerHeight - BODY_HEIGHT)
  return {
    left: Math.max(0, Math.min(left, maxLeft)),
    top: Math.max(0, Math.min(top, maxTop)),
  }
}

function centerFromPointer(clientX, clientY) {
  return clampPosition(clientX - BODY_WIDTH / 2, clientY - BODY_HEIGHT / 2)
}

function setGlobalGrabbing(active) {
  if (typeof document === 'undefined') return
  document.body.style.cursor = active ? 'grabbing' : ''
  document.body.style.userSelect = active ? 'none' : ''
}

export function useLanbitouMascotDrag() {
  const position = ref(readSavedPosition())
  const dragging = ref(false)

  let pointerId = null
  let startX = 0
  let startY = 0
  let pendingPointerId = null

  const hasCustomPosition = computed(() => position.value != null)

  const rootStyle = computed(() => {
    if (!position.value) return null
    return {
      left: `${position.value.left}px`,
      top: `${position.value.top}px`,
      right: 'auto',
      bottom: 'auto',
    }
  })

  const syncPositionWithinViewport = () => {
    if (!position.value) return
    position.value = clampPosition(position.value.left, position.value.top)
    writeSavedPosition(position.value)
  }

  const attachDragListeners = () => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  const detachDragListeners = () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  const finishDrag = () => {
    if (!dragging.value && pendingPointerId == null) return
    dragging.value = false
    setGlobalGrabbing(false)
    pointerId = null
    pendingPointerId = null
    writeSavedPosition(position.value)
    detachDragListeners()
  }

  const applyCenteredPosition = (clientX, clientY) => {
    position.value = centerFromPointer(clientX, clientY)
  }

  const onPointerMove = (event) => {
    if (!dragging.value) {
      if (pendingPointerId == null || event.pointerId !== pendingPointerId) return
      const dx = event.clientX - startX
      const dy = event.clientY - startY
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return

      dragging.value = true
      pointerId = event.pointerId
      setGlobalGrabbing(true)
      applyCenteredPosition(event.clientX, event.clientY)
      return
    }

    if (event.pointerId !== pointerId) return
    applyCenteredPosition(event.clientX, event.clientY)
  }

  const onPointerUp = (event) => {
    if (pendingPointerId != null && event.pointerId === pendingPointerId && !dragging.value) {
      pendingPointerId = null
      detachDragListeners()
      return
    }
    if (!dragging.value || event.pointerId !== pointerId) return
    finishDrag()
  }

  const onPointerDown = (event) => {
    if (event.button !== 0) return

    startX = event.clientX
    startY = event.clientY
    pendingPointerId = event.pointerId

    if (!position.value) {
      applyCenteredPosition(event.clientX, event.clientY)
    }

    attachDragListeners()
    event.preventDefault()
  }

  onMounted(() => {
    window.addEventListener('resize', syncPositionWithinViewport)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncPositionWithinViewport)
    finishDrag()
  })

  return {
    position,
    dragging,
    hasCustomPosition,
    rootStyle,
    onPointerDown,
    BODY_WIDTH,
    BODY_HEIGHT,
  }
}

export function getMascotBodyRect(position, { peek = false } = {}) {
  let rect
  if (position) {
    rect = {
      left: position.left,
      top: position.top,
      width: BODY_WIDTH,
      height: BODY_HEIGHT,
      right: position.left + BODY_WIDTH,
      bottom: position.top + BODY_HEIGHT,
    }
  } else {
    const right = window.innerWidth <= 720 ? 10 : 18
    const left = window.innerWidth - right - BODY_WIDTH
    const top = window.innerHeight - BODY_HEIGHT
    rect = {
      left,
      top,
      width: BODY_WIDTH,
      height: BODY_HEIGHT,
      right: left + BODY_WIDTH,
      bottom: top,
    }
  }

  if (!peek) return rect

  const peekOffset = BODY_HEIGHT * 0.42
  return {
    ...rect,
    top: rect.top + peekOffset,
    height: rect.height - peekOffset,
    bottom: rect.bottom,
  }
}
