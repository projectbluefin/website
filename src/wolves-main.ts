import { createPinia } from 'pinia'
import { createApp } from 'vue'
import WolvesApp from './WolvesApp.vue'
import './style/index.scss'
import './style/wolves-cinematic.scss'

const app = createApp(WolvesApp)
app.use(createPinia())
app.mount('#app')
