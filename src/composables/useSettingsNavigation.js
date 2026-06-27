export const SETTINGS_NAV_TARGETS = {
  sedimentTemplateAdd: 'sediment-template-add',
}

let navigateHandler = null

export function registerSettingsNavigator(handler) {
  navigateHandler = handler
  return () => {
    if (navigateHandler === handler) navigateHandler = null
  }
}

export function navigateToSettings(target = null) {
  navigateHandler?.(target)
}
