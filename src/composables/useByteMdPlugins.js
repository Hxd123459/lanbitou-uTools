import gfm from '@bytemd/plugin-gfm'
import highlight from '@bytemd/plugin-highlight'
import { slashCommandPlugin } from '../plugins/bytemdSlashCommand'
import { previewScrollSyncPlugin } from '../plugins/previewScrollSyncPlugin'

export function getByteMdViewerPlugins() {
  return [gfm(), highlight()]
}

export function getByteMdEditorPlugins() {
  return [gfm(), highlight(), slashCommandPlugin(), previewScrollSyncPlugin()]
}
