import {
  executeNoteSearchTool,
  NOTE_SEARCH_TOOL_NAMES,
} from '../ai/noteSearchTools'

export function setupUtoolsTools() {
  if (typeof window === 'undefined' || typeof window.utools?.registerTool !== 'function') {
    return
  }

  for (const name of NOTE_SEARCH_TOOL_NAMES) {
    window.utools.registerTool(name, async (params) => {
      return executeNoteSearchTool(name, params || {})
    })
  }
}
