import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueRendererMarkdown from 'vue-renderer-markdown'
import 'vue-renderer-markdown/index.css'
import './assets/styles/tokens.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueRendererMarkdown)

app.mount('#app')
