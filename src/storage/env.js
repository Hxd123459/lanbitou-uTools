export function isUtoolsMode() {
  return typeof window !== 'undefined' && !!window.utools?.db
}
