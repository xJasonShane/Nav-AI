/**
 * 站点图标解析结果的会话级缓存：
 * 同一域名下的多个站点共享「第几档可用 / 全部失败」的结论，避免重复请求站点 favicon 与图标服务，
 * 也减少向第三方图标服务暴露域名的次数。键为 `域名|图标源设置`，值为可用档位下标，-1 表示全部失败。
 */
const cache = new Map()

export function cachedStep(key) {
  return key && cache.has(key) ? cache.get(key) : null
}

export function rememberStep(key, step) {
  if (key) cache.set(key, step)
}
