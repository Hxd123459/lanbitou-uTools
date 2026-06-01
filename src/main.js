import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bytemd/dist/index.css'
import 'highlight.js/styles/github.css'
import './assets/styles/tokens.css'
import './assets/styles/buttons.css'
import './assets/styles/bytemd-preview.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
