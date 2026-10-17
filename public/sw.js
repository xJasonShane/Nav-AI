/**
 * Nav-AI 离线外壳（PWA）
 * 策略：
 *   - 仅处理同源 GET 请求；第三方请求（如图标服务）完全不介入
 *   - 导航请求：网络优先（保证总能拿到最新 HTML），离线时回退缓存
 *   - 带 hash 的静态资源：缓存优先（内容不可变，可直接命中）
 *   - install 时解析首屏 HTML 并预缓存 JS/CSS，保证「首次访问后立刻断网」也能打开
 *   - activate 时按当前 HTML 的引用集合清理旧版本资源，避免缓存无限增长
 *   - 不自动 skipWaiting：由页面确认后发消息触发，避免旧页面加载到已被清理的旧 chunk
 */
const CACHE = 'nav-ai-shell-v2'

/** 解析 HTML 中同源、且在应用作用域内的 script / link 资源 */
function assetUrls(html, scope) {
  const urls = new Set()
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
    try {
      const url = new URL(match[1], scope)
      if (url.origin === self.location.origin && url.href.startsWith(scope)) urls.add(url.href)
    } catch (e) {
      /* 非法 URL 忽略 */
    }
  }
  return urls
}

async function precache() {
  const scope = self.registration.scope
  const cache = await caches.open(CACHE)
  const response = await fetch(scope, { cache: 'reload' })
  if (!response.ok) return

  const html = await response.clone().text()
  await cache.put(scope, response)

  // 逐个缓存：单个资源失败不影响其余资源的离线可用性
  const urls = assetUrls(html, scope)
  await Promise.all([...urls].map((url) => cache.add(url).catch(() => {})))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}))
})

// 页面点击「刷新」后触发：立即接管并清理旧资源
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))

      // 只保留当前版本 HTML 引用的资源，删除历史 hash 文件
      const cache = await caches.open(CACHE)
      const scope = self.registration.scope
      const html = await cache.match(scope)
      const keep = html ? new Set([scope, ...assetUrls(await html.text(), scope)]) : new Set([scope])
      const requests = await cache.keys()
      await Promise.all(
        requests.filter((request) => !keep.has(request.url)).map((request) => cache.delete(request))
      )

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
          return (
            (await caches.match(request)) ||
            (await caches.match(self.registration.scope)) ||
            Response.error()
          )
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
