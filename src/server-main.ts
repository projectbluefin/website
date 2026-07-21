// @ts-expect-error Known issues, that's why we use it as a plugin
import IframeResizerPlugin from '@iframe-resizer/vue'
import { createApp } from 'vue'
import { i18n } from './locales/schema'
import ServerApp from './ServerApp.vue'
import './style/index.scss'

const app = createApp(ServerApp)
app.use(i18n)
app.use(IframeResizerPlugin)
app.mount('#app')
