const MIRROR_PROPS = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
]

export function getTextareaCaretCoords(textarea, position) {
  if (!textarea) return { left: 0, top: 0, height: 0 }

  const div = document.createElement('div')
  const style = window.getComputedStyle(textarea)
  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  div.style.top = '0'
  div.style.left = '-9999px'

  MIRROR_PROPS.forEach((prop) => {
    div.style[prop] = style[prop]
  })

  const text = textarea.value.substring(0, position)
  div.textContent = text

  const span = document.createElement('span')
  span.textContent = textarea.value.substring(position) || '.'
  div.appendChild(span)

  document.body.appendChild(div)

  const textareaRect = textarea.getBoundingClientRect()
  const spanRect = span.getBoundingClientRect()
  const divRect = div.getBoundingClientRect()

  const left =
    textareaRect.left +
    (spanRect.left - divRect.left) -
    textarea.scrollLeft
  const top =
    textareaRect.top +
    (spanRect.top - divRect.top) -
    textarea.scrollTop

  document.body.removeChild(div)

  return {
    left,
    top,
    height: parseFloat(style.lineHeight) || spanRect.height,
  }
}
