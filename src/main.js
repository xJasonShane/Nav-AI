import { createApp } from 'vue'
import App from './App.vue'
import { applyTheme } from './store/data.js'
import './style.css'

applyTheme()
createApp(App).mount('#app')
