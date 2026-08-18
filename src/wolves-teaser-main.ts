import { createPinia } from 'pinia'
import { createApp } from 'vue'
import WolvesTeaserApp from './WolvesTeaserApp.vue'
import '@fontsource/michroma'
import '@fontsource/share-tech-mono'
import './style/index.scss'
import './style/wolves-cinematic.scss'

const app = createApp(WolvesTeaserApp)
app.use(createPinia())
app.mount('#app')
