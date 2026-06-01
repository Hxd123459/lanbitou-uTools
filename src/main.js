import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/styles/tokens.css'
import './assets/styles/buttons.css'
import 'highlight.js/styles/github.min.css'
import './assets/styles/tiptap-content.css'
import './assets/styles/tiptap-slash-menu.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
