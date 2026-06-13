import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Link from '@tiptap/extension-link'
import Strike from '@tiptap/extension-strike'

const CODE_MARK = 'code'

function nodeHasCodeMark(node) {
  return (
    node?.type === 'text'
    && Array.isArray(node.marks)
    && node.marks.some((mark) => mark.type === CODE_MARK)
  )
}

function applyMarkToNode(node, markType, attrs) {
  if (nodeHasCodeMark(node) || node.type !== 'text') {
    return [node]
  }

  const mark = attrs ? { type: markType, attrs } : { type: markType }

  return [{
    ...node,
    marks: [...(node.marks || []), mark],
  }]
}

export function createCodeSafeMarkParser(markType, getAttrs) {
  return (token, helpers) => {
    const content = helpers.parseInline(token.tokens || [])
    const attrs = getAttrs?.(token)

    return content.flatMap((node) => applyMarkToNode(node, markType, attrs))
  }
}

export const CodeSafeBold = Bold.extend({
  parseMarkdown: createCodeSafeMarkParser('bold'),
})

export const CodeSafeItalic = Italic.extend({
  parseMarkdown: createCodeSafeMarkParser('italic'),
})

export const CodeSafeStrike = Strike.extend({
  parseMarkdown: createCodeSafeMarkParser('strike'),
})

export const CodeSafeLink = Link.extend({
  parseMarkdown: (token, helpers) =>
    createCodeSafeMarkParser('link', () => ({
      href: token.href,
      title: token.title || null,
    }))(token, helpers),
})
