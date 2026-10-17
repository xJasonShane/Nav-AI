import { createApp } from 'vue'
import App from './App.vue'
import { applyAppearance } from './store/data.js'
import { reportError } from './utils/errors.js'
import { showToast } from './utils/toast.js'
import './style.css'

applyAppearance()

const app = createApp(App)
// 组件渲染 / 生命周期异常：转成可见提示，避免整树卸载后白屏且无任何反馈
app.config.errorHandler = (error) => reportError(error, '渲染')
app.mount('#app')

// 脚本错误与未处理的 Promise 拒绝：同样收口到提示条
window.addEventListener('error', (event) => reportError(event.error || event.message, '脚本'))
window.addEventListener('unhandledrejection', (event) => reportError(event.reason, '异步'))

// PWA 离线外壳：仅在生产构建注册（开发环境跳过，避免缓存干扰热更新）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    let registration
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    } catch (e) {
      return // 注册失败不影响使用
    }

    // 新版本就绪后由用户确认：先 skipWaiting 再 reload，避免旧页面去加载已被清理的旧 chunk
    let notified = false
    const notify = (worker) => {
      if (notified) return
      notified = true
      showToast('应用已更新', {
        label: '刷新',
        run: () => {
          worker.postMessage('skip-waiting')
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
        },
      }, undefined, 'low')
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      if (!worker) return
      worker.addEventListener('statechange', () => {
        // 首次安装没有 controller，不提示；后续更新才提示
        if (worker.state === 'installed' && navigator.serviceWorker.controller) notify(worker)
      })
    })

    // 兜底：页面加载时已经存在 waiting worker（上次未刷新，updatefound 不会再触发）
    if (registration.waiting && navigator.serviceWorker.controller) notify(registration.waiting)
  })
}
