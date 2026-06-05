import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

function stripCrossorigin(html) {
  return html.replace(/\s+crossorigin(="[^"]*")?/g, '')
}

/** uTools 以 file:// 加载 dist，crossorigin / modulepreload 会导致脚本静默失败白屏 */
function utoolsBuildPlugin() {
  return {
    name: 'utools-build',
    transformIndexHtml(html) {
      return stripCrossorigin(html)
    },
    closeBundle() {
      const distDir = path.resolve('dist')
      const indexPath = path.join(distDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8')
        fs.writeFileSync(indexPath, stripCrossorigin(html))
      }

      const pluginPath = path.join(distDir, 'plugin.json')
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
  build: {
    modulePreload: false,
    target: 'chrome100',
  },
}))
