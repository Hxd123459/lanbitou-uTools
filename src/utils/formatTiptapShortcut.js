function detectIsMac() {
  if (typeof navigator === 'undefined') return false

  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    ''

  return /Mac|iPhone|iPad|iPod/i.test(platform)
}

export function formatTiptapShortcut(shortcut) {
  if (!shortcut) return ''

  const isMac = detectIsMac()
  const labels = shortcut.split('-').map((part) => {
    if (part === 'Mod') return isMac ? '⌘' : 'Ctrl'
    if (part === 'Alt') return isMac ? '⌥' : 'Alt'
    if (part === 'Shift') return isMac ? '⇧' : 'Shift'
    return part.length === 1 ? part.toUpperCase() : part
  })

  return isMac ? labels.join('') : labels.join('+')
}
