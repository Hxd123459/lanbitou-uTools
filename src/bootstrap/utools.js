export function setupUtools() {
  if (typeof window === 'undefined' || !window.utools) return

  window.utools.onPluginEnter((action) => {
    window.__utoolsEnterAction = action
  })

  window.utools.onPluginOut(() => {
    window.__utoolsEnterAction = null
  })
}
