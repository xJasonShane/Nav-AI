import { createApp } from 'vue'
import App from './App.vue'
import { applyAppearance } from './store/data.js'
import './style.css'

applyAppearance()
createApp(App).mount('#app')
