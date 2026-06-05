import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/styles/fonts.css'
import './assets/styles/tokens.css'
import './assets/styles/buttons.css'
import './assets/styles/tiptap-content.css'

import { setupUtools } from './bootstrap/utools'
import App from './App.vue'
import router from './router'

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[烂笔头]', event.error || event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[烂笔头]', event.reason)
  })
}

setupUtools()

const app = createApp(App)

app.config.errorHandler = (err, _instance, info) => {
  console.error('[烂笔头]', err, info)
}

app.use(createPinia())
app.use(router)

app.mount('#app')
