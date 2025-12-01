import { createApp } from 'vue'
import { i18n } from './locales/schema'
import TestingApp from './TestingApp.vue'
import './style/index.scss'

const app = createApp(TestingApp)
app.use(i18n)
app.mount('#app')
