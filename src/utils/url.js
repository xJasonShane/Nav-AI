/**
 * URL 工具（纯函数）：
 *  - safeHttpUrl：只放行可解析且带 host 的 http(s)，其余（javascript: / data: / 相对路径 /
 *    `https://` 这类空 host）一律返回空串
 *  - isHttpUrl：布尔判断，供组件决定是否渲染可点击链接
 *
 * 数据归一化、卡片链接与只读分享页共用同一口径，避免「导出安全、主站不安全」的偏差。
 * 注意：这里只保证「可安全打开」，表单校验另行要求域名后缀（isValidHttpUrl）。
 */
export function safeHttpUrl(value) {
  const text = String(value ?? '').trim()
  if (!text || !/^https?:\/\//i.test(text)) return ''
  try {
    const url = new URL(text)
    // `https://` / `https://?x` 能被 new URL 接受但 host 为空，必须拒绝，否则会渲染死链
    if (!url.hostname || url.hostname === '.') return ''
    return text
  } catch {
    return ''
  }
}

export function isHttpUrl(value) {
  return safeHttpUrl(value) !== ''
}

/** URL 去重键：忽略协议、www 前缀、末尾斜杠与大小写（批量/书签/合并导入共用） */
export function urlKey(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
}

/**
 * 是否是可用于导航的 http(s) 地址（表单校验用）：
 * 除协议外还要求 host 形如域名 / IP，排除 `https://foo` 这类缺少后缀的误输入。
 */
export function isValidHttpUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return url.hostname === 'localhost' || url.hostname.includes('.')
  } catch {
    return false
  }
}
