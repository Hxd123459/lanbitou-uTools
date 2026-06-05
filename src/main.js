import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/styles/tokens.css'
import './assets/styles/buttons.css'
import './assets/styles/tiptap-content.css'

import { setupUtools } from './bootstrap/utools'
import App from './App.vue'
import router from './router'

setupUtools()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
