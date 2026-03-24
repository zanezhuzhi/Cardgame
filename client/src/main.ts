import { createApp } from 'vue'
import { createPinia } from 'pinia'
import RootApp from './RootApp.vue'
import router from './router'
import './styles/theme-wafuu.css'

const app = createApp(RootApp)
app.use(createPinia())
app.use(router)
app.mount('#app')