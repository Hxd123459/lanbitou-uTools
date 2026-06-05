import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/** uTools 以 file:// 加载 dist，Vite 默认 crossorigin 会导致脚本静默失败白屏 */
function utoolsBuildPlugin() {
  return {
    name: 'utools-build',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(="[^"]*")?/g, '')
    },
    closeBundle() {
      const pluginPath = path.resolve('dist/plugin.json')
      if (!fs.existsSync(pluginPath)) return
      const json = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'))
      delete json.development
      fs.writeFileSync(pluginPath, `${JSON.stringify(json, null, 2)}\n`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    vue(),
    utoolsBuildPlugin(),
    mode === 'development' && vueDevTools(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
}))
