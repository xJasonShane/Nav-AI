/**
 * URL 工具（纯函数）：
 *  - safeHttpUrl：只放行 http(s)，其余（javascript: / data: / 相对路径 / 空值）一律返回空串
 *  - isHttpUrl：布尔判断，供组件决定是否渲染可点击链接
 *
 * 数据归一化、卡片链接与只读分享页共用同一口径，避免「导出安全、主站不安全」的偏差。
 */
export function safeHttpUrl(value) {
  const text = String(value ?? '').trim()
  return /^https?:\/\//i.test(text) ? text : ''
}

export function isHttpUrl(value) {
  return safeHttpUrl(value) !== ''
}
