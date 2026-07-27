import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

function stripCrossorigin(html) {
  return html.replace(/\s+crossorigin(="[^"]*")?/g, '')
}

/** uTools 应用市场禁止引入网络 js/css */
function stripExternalAssets(html) {
  return html
    .replace(/<link[^>]+href=["']https?:\/\/[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<script[^>]+src=["']https?:\/\/[^"']+["'][^>]*>\s*<\/script>\s*/gi, '')
}

/** uTools 以 file:// 加载 dist，crossorigin / modulepreload 会导致脚本静默失败白屏 */
function copyBridgeToDist(distDir) {
  const src = path.resolve('bridge')
  const dest = path.join(distDir, 'bridge')
  if (!fs.existsSync(path.join(src, 'server.js'))) return

  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true })
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }

  const lockFile = path.join(dest, 'package-lock.json')
  const installArgs = fs.existsSync(lockFile)
    ? 'ci --omit=dev'
    : 'install --omit=dev'
  execSync(`npm ${installArgs}`, {
    cwd: dest,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })
}

function utoolsBuildPlugin() {
  return {
    name: 'utools-build',
    transformIndexHtml(html) {
      return stripExternalAssets(stripCrossorigin(html))
    },
    closeBundle() {
      const distDir = path.resolve('dist')
      const indexPath = path.join(distDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8')
        fs.writeFileSync(indexPath, stripExternalAssets(stripCrossorigin(html)))
      }

      const pluginPath = path.join(distDir, 'plugin.json')
      if (!fs.existsSync(pluginPath)) return
      const json = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'))
      delete json.development
      fs.writeFileSync(pluginPath, `${JSON.stringify(json, null, 2)}\n`)

      copyBridgeToDist(distDir)
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
