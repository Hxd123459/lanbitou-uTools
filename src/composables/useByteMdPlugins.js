import gfm from '@bytemd/plugin-gfm'
import highlight from '@bytemd/plugin-highlight'
import { slashCommandPlugin } from '../plugins/bytemdSlashCommand'

export function getByteMdViewerPlugins() {
  return [gfm(), highlight()]
}

export function getByteMdEditorPlugins() {
  return [gfm(), slashCommandPlugin()]
}
