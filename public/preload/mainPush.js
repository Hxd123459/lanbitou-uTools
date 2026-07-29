/**
 * uTools preload（CommonJS）
 * 根目录 package.json 为 "type":"module"，故本目录另有 package.json: { "type":"commonjs" }
 * 必须使用 .js 扩展名（uTools 不认 .cjs）
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const NOTE_PREFIX = 'lanbitou/note/'
const STRUCT_NOTE_PREFIX = 'lanbitou/struct/note/'
const SEARCH_CODE = 'search_notes'
const MAX_RESULTS = 8
const SNIPPET_LEN = 72
const PREVIEW_PLUGIN = '文件预览'

/** 「文件预览」插件按扩展名拆了多个 files 指令，没有叫「文件预览」的 cmd */
const PREVIEW_CMD_RULES = [
  { cmd: '图片预览', re: /\.(jpe?g|png|gif|bmp|svg|webp|ico)$/i },
  { cmd: '视频预览', re: /\.(mp4|webm|ogg|avi)$/i },
  { cmd: '音乐预览', re: /\.(mp3|m4a|flac|aac|wav)$/i },
  { cmd: 'PDF预览', re: /\.pdf$/i },
  { cmd: '办公预览', re: /\.(docx|xlsx)$/i },
  { cmd: '演示文稿预览', re: /\.pptx$/i },
  { cmd: '表格预览', re: /\.csv$/i },
  { cmd: '压缩包预览', re: /\.zip$/i },
  { cmd: 'PSD预览', re: /\.psd$/i },
  { cmd: 'Notebook预览', re: /\.ipynb$/i },
  { cmd: '邮件预览', re: /\.eml$/i },
  { cmd: '思维导图预览', re: /\.xmind$/i },
  { cmd: '电子书预览', re: /\.epub$/i },
  {
    cmd: '代码预览',
    re: /\.(asm|bash|bat|bib|c|clj|cljs|cmake|cmd|coffee|cpp|cs|css|dart|diff|dockerfile|erl|ex|exs|go|gradle|groovy|h|hpp|hs|htm|html|ini|java|js|jsx|json|kt|kts|less|lisp|log|lua|makefile|markdown|md|nfo|patch|php|php3|phtml|pl|pm|ps1|psd1|psm1|py|pyw|r|rb|rs|rst|rtf|scala|scss|sh|sql|svelte|swift|tex|toml|ts|tsx|vue|xml|yaml|yml|zsh)$/i,
  },
  { cmd: '文本预览', re: /\.(txt|cfg|conf|properties)$/i },
]

function getUtools() {
  if (typeof utools !== 'undefined') return utools
  if (typeof window !== 'undefined' && window.utools) return window.utools
  if (typeof global !== 'undefined' && global.utools) return global.utools
  return null
}

function resolvePreviewCmd(fileName) {
  const name = String(fileName || '')
  for (let i = 0; i < PREVIEW_CMD_RULES.length; i += 1) {
    if (PREVIEW_CMD_RULES[i].re.test(name)) return PREVIEW_CMD_RULES[i].cmd
  }
  return ''
}

function sanitizeFileName(name) {
  const raw = String(name || 'attachment.bin').trim() || 'attachment.bin'
  return raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180)
}

function toNodeBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes)
  if (ArrayBuffer.isView(bytes)) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  if (Array.isArray(bytes)) return Buffer.from(bytes)
  throw new Error('附件数据无效')
}

function writeTempAttachment(fileName, bytes) {
  const safeName = sanitizeFileName(fileName)
  const dir = path.join(os.tmpdir(), 'lanbitou-preview')
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${Date.now()}_${safeName}`)
  fs.writeFileSync(filePath, toNodeBuffer(bytes))
  return filePath
}

/**
 * 将附件落到临时文件，并 redirect 到「文件预览」对应指令。
 * xlsx/docx → 办公预览；pdf → PDF预览；……
 * @see https://www.u-tools.cn/docs/developer/utools-api/window.html
 */
function openInFilePreview(fileName, bytes) {
  const api = getUtools()
  const safeName = sanitizeFileName(fileName)
  const cmd = resolvePreviewCmd(safeName)
  if (!cmd) {
    return {
      ok: false,
      path: '',
      error: '当前文件类型暂不支持预览',
    }
  }
  const filePath = writeTempAttachment(safeName, bytes)
  if (!api || typeof api.redirect !== 'function') {
    return { ok: false, path: filePath, error: 'redirect unavailable' }
  }
  const ok = api.redirect([PREVIEW_PLUGIN, cmd], {
    type: 'files',
    data: filePath,
  })
  return { ok: !!ok, path: filePath, cmd }
}

function setupAttachmentServices() {
  if (typeof window === 'undefined') return
  window.services = window.services || {}
  window.services.attachment = {
    writeTempFile: writeTempAttachment,
    openInFilePreview: openInFilePreview,
  }
}

function normalizeKeywords(text) {
  const parts = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const seen = {}
  const list = []
  for (let i = 0; i < parts.length; i += 1) {
    if (seen[parts[i]]) continue
    seen[parts[i]] = true
    list.push(parts[i])
  }
  return list
}

function buildHaystack(parts) {
  let out = ''
  for (let i = 0; i < parts.length; i += 1) {
    if (!parts[i]) continue
    if (out) out += '\n'
    out += String(parts[i]).slice(0, 2000)
  }
  return out.toLowerCase()
}

function matchesKeywords(haystack, keywords) {
  if (!keywords.length) return false
  for (let i = 0; i < keywords.length; i += 1) {
    if (haystack.indexOf(keywords[i].toLowerCase()) < 0) return false
  }
  return true
}

function extractSnippet(rawText, keywords) {
  const text = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  const lower = text.toLowerCase()
  let index = -1
  for (let i = 0; i < keywords.length; i += 1) {
    const pos = lower.indexOf(keywords[i].toLowerCase())
    if (pos >= 0 && (index < 0 || pos < index)) index = pos
  }
  if (index < 0) return text.slice(0, SNIPPET_LEN)
  const start = Math.max(0, index - 12)
  const slice = text.slice(start, start + SNIPPET_LEN)
  return (start > 0 ? '...' : '') + slice
}

function ensureDocs(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value.then === 'function') return []
  return []
}

function searchNotesSync(api, payload) {
  const keywords = normalizeKeywords(payload)
  if (!keywords.length) return []
  if (!api || !api.db || typeof api.db.allDocs !== 'function') return []

  const results = []

  try {
    const noteDocs = ensureDocs(api.db.allDocs(NOTE_PREFIX))
    for (let i = 0; i < noteDocs.length; i += 1) {
      if (results.length >= MAX_RESULTS) break
      const doc = noteDocs[i]
      if (!doc || !doc.id || doc.deletedAt || doc.archivedAt) continue
      const haystack = buildHaystack([
        doc.title,
        doc.summary,
        doc.rawContent,
        doc.markdownContent,
      ])
      if (!matchesKeywords(haystack, keywords)) continue
      const content = doc.markdownContent || doc.rawContent || doc.summary || ''
      results.push({
        noteId: doc.id,
        noteType: 'fragment',
        title: doc.title || '无标签',
        text: extractSnippet(content, keywords) || doc.title || '碎片笔记',
        createTime: doc.createTime || '',
      })
    }
  } catch (error) {
    console.error('[烂笔头] mainPush 搜索碎片失败', error)
  }

  try {
    if (results.length < MAX_RESULTS) {
      const structDocs = ensureDocs(api.db.allDocs(STRUCT_NOTE_PREFIX))
      for (let i = 0; i < structDocs.length; i += 1) {
        if (results.length >= MAX_RESULTS) break
        const doc = structDocs[i]
        if (!doc || !doc.id || doc.deletedAt) continue
        const haystack = buildHaystack([doc.title, doc.content])
        if (!matchesKeywords(haystack, keywords)) continue
        results.push({
          noteId: doc.id,
          noteType: 'sediment',
          title: doc.title || '无标题',
          text: extractSnippet(doc.content || '', keywords) || doc.title || '沉淀长文',
          createTime: doc.createTime || '',
        })
      }
    }
  } catch (error) {
    console.error('[烂笔头] mainPush 搜索沉淀失败', error)
  }

  results.sort(function (a, b) {
    return String(b.createTime || '').localeCompare(String(a.createTime || ''))
  })

  return results.slice(0, MAX_RESULTS).map(function (item) {
    const isSediment = item.noteType === 'sediment'
    return {
      icon: isSediment ? 'icons/sediment.svg' : 'icons/fragment.svg',
      title: isSediment ? '[沉淀] ' + item.title : item.title,
      text: item.text,
      noteId: item.noteId,
      noteType: item.noteType,
      noteTitle: item.title,
    }
  })
}

function stashPendingSearch(action) {
  if (!action || action.code !== SEARCH_CODE) return
  const option = action.option || {}
  const payload = action.payload
  const keyword =
    typeof payload === 'string'
      ? String(payload).trim()
      : (window.__lanbitouPendingSearch && window.__lanbitouPendingSearch.keyword) || ''
  if (!keyword && !option.noteId) return
  window.__lanbitouPendingSearch = {
    keyword: keyword,
    id: option.noteId || '',
    noteId: option.noteId || '',
    type: option.noteType || 'fragment',
    noteType: option.noteType || 'fragment',
    title: option.noteTitle || option.title || '',
  }
  window.__lanbitouOpenNote = window.__lanbitouPendingSearch
}

function emitSubInput(text) {
  window.__lanbitouSubInputText = text
  try {
    window.dispatchEvent(
      new CustomEvent('lanbitou:subinput', { detail: { text: String(text || '') } }),
    )
  } catch (error) {
    console.error('[烂笔头] subInput 事件失败', error)
  }
}

var subInputTimer = null

function bindSubInput(api) {
  if (!api || typeof api.setSubInput !== 'function') return
  var windowType = typeof api.getWindowType === 'function' ? api.getWindowType() : 'main'
  if (windowType !== 'main') {
    if (typeof api.removeSubInput === 'function') api.removeSubInput()
    return
  }
  window.__lanbitouPreloadSubInput = true
  api.setSubInput(function (details) {
    var text = details && details.text != null ? details.text : ''
    if (subInputTimer) clearTimeout(subInputTimer)
    subInputTimer = setTimeout(function () {
      subInputTimer = null
      emitSubInput(text)
    }, 180)
  }, '搜索笔记…')
}

function setupMainPush() {
  const api = getUtools()
  if (!api || typeof api.onMainPush !== 'function') {
    console.error('[烂笔头] onMainPush 不可用')
    return
  }

  api.onMainPush(
    function (action) {
      try {
        if (!action || action.code !== SEARCH_CODE) return []
        if (typeof action.payload !== 'string') return []
        return searchNotesSync(api, action.payload)
      } catch (error) {
        console.error('[烂笔头] onMainPush 回调异常', error)
        return []
      }
    },
    function (action) {
      try {
        if (!action || action.code !== SEARCH_CODE) return
        stashPendingSearch(action)
        return true
      } catch (error) {
        console.error('[烂笔头] onMainPush 选择异常', error)
        return true
      }
    },
  )
}

function setupLifecycle() {
  const api = getUtools()
  if (!api) return

  if (typeof api.onPluginEnter === 'function') {
    api.onPluginEnter(function (action) {
      stashPendingSearch(action)
      bindSubInput(api)
      if (
        action &&
        action.code === SEARCH_CODE &&
        typeof action.payload === 'string' &&
        action.payload &&
        typeof api.setSubInputValue === 'function'
      ) {
        try {
          api.setSubInputValue(String(action.payload).trim())
        } catch (_) {
          /* ignore */
        }
      }
    })
  }

  if (typeof api.onPluginOut === 'function') {
    api.onPluginOut(function () {
      if (typeof api.removeSubInput === 'function') api.removeSubInput()
    })
  }

  if (typeof api.onPluginDetach === 'function') {
    api.onPluginDetach(function () {
      if (typeof api.removeSubInput === 'function') api.removeSubInput()
    })
  }
}

setupMainPush()
setupLifecycle()
setupAttachmentServices()
try {
  const agentBridge = require('./agentBridge.js')
  if (typeof window !== 'undefined') {
    window.services = window.services || {}
    window.services.agent = {
      ensureStarted: () => agentBridge.ensureStarted(),
      request: (method, urlPath, body, headers, options) =>
        agentBridge.request(method, urlPath, body, headers, options),
      pickDirectory: () => agentBridge.pickDirectory(),
      pathExists: (target) => agentBridge.pathExists(target),
      revealInFolder: (target) => agentBridge.revealInFolder(target),
      healthCheck: () => agentBridge.healthCheck(),
      port: agentBridge.DEFAULT_PORT,
    }
    void agentBridge.ensureStarted().catch((error) => {
      console.warn('[烂笔头] agentBridge 后台启动失败', error?.message || error)
    })
  }
} catch (error) {
  console.warn('[烂笔头] agentBridge 加载失败', error)
}
console.log('[烂笔头] preload mainPush.js 已加载')