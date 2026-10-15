import { createApp } from 'vue'
import App from './App.vue'
import { applyAppearance } from './store/data.js'
import './style.css'

applyAppearance()
createApp(App).mount('#app')

// PWA 离线外壳：仅在生产构建注册（开发环境跳过，避免缓存干扰热更新）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 注册失败不影响使用 */ })
  })
}
