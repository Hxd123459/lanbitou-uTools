const PIN_WEIGHT = { TOP: 999, DEFAULT: 0, BOTTOM: -999 }
const WEIGHT_TO_TYPE = {
  999: 'TOP',
  0: 'DEFAULT',
  '-999': 'BOTTOM',
}

export function pinTypeToWeight(type) {
  return PIN_WEIGHT[type] ?? PIN_WEIGHT.DEFAULT
}

export function pinWeightToType(weight) {
  if (weight == null) return 'DEFAULT'
  return WEIGHT_TO_TYPE[String(weight)] ?? 'DEFAULT'
}
