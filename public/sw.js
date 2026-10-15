/**
 * Nav-AI 离线外壳（PWA）
 * 策略：
 *   - 仅处理同源 GET 请求；第三方请求（如图标服务）完全不介入
 *   - 导航请求：网络优先（保证总能拿到最新 HTML），离线时回退缓存
 *   - 带 hash 的静态资源：缓存优先（内容不可变，可直接命中）
 * 数据本身存在 localStorage，因此离线打开后功能完整。
 */
const CACHE = 'nav-ai-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })()
  )
})

async function cachePut(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return
  const cache = await caches.open(CACHE)
  await cache.put(request, response)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          event.waitUntil(cachePut(request, fresh.clone()))
          return fresh
        } catch {
          return (await caches.match(request)) || (await caches.match('/')) || Response.error()
        }
      })()
    )
    return
  }

  event.respondWith(
    (async () => {
      const hit = await caches.match(request)
      if (hit) return hit
      const response = await fetch(request)
      event.waitUntil(cachePut(request, response.clone()))
      return response
    })()
  )
})
