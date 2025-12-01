// @ts-expect-error Known issues, that's why we use it as a plugin, See here: https://github.com/davidjbradshaw/iframe-resizer/issues/1363
import IframeResizerPlugin from '@iframe-resizer/vue'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './locales/schema'
import './style/index.scss'

const app = createApp(App)
app.use(i18n)
app.use(IframeResizerPlugin)
app.mount('#app')
