/**
 * 只读分享页导出（F9）：把当前导航数据生成一份自包含 HTML。
 * 特点：零外部请求（图标用字母头像）、数据全部内联、样式内联，可直接发给别人或用浏览器打开。
 */
import { safeHttpUrl } from './url.js'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** HTML 转义，所有来自用户数据的文本都必须经过这里 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/** 从 URL 取域名（去掉 www.），解析失败返回空串 */
function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** 与卡片一致的字母头像配（按名称散列取色，避免每个分享页都长一样） */
const PALETTE = ['#4f7cff', '#9b5cff', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

function avatarColor(name) {
  const s = String(name || '?')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function cardHtml(site) {
  const url = safeHttpUrl(site.url)
  const name = escapeHtml(site.name || domainOf(site.url) || '未命名')
  if (!url) return ''
  const desc = escapeHtml(site.desc || domainOf(url))
  const initial = escapeHtml(String(site.name || domainOf(url) || '?').trim().charAt(0).toUpperCase())
  return `<li class="c"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
<span class="i" style="background:${avatarColor(site.name)}">${initial}</span>
<span class="m"><b>${name}</b><em>${desc}</em></span></a></li>`
}

const STYLE = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#f6f8fd;color:#222838;line-height:1.5;padding:32px 20px 64px}
.wrap{max-width:1100px;margin:0 auto}
h1{font-size:22px;margin-bottom:6px}
.tip{color:#67718a;font-size:13px;margin-bottom:24px}
h2{font-size:16px;margin:26px 0 10px;display:flex;align-items:center;gap:8px}
h2 s{text-decoration:none;font-size:15px}
h3{font-size:14px;color:#59637a;margin:16px 0 8px}
ul{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.c a{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1px solid #e7ebf5;border-radius:12px;text-decoration:none;color:inherit}
.c a:hover{border-color:#4f7cff;box-shadow:0 4px 12px -2px rgba(45,70,140,.16)}
.i{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;flex-shrink:0}
.m{min-width:0}
.m b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m em{display:block;font-style:normal;font-size:12px;color:#67718a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
footer{margin-top:36px;color:#67718a;font-size:12px}
@media (prefers-color-scheme:dark){body{background:#0a0f1b;color:#e8ecf6}.c a{background:#161d2e;border-color:#253048}.tip,.m em,footer,h3{color:#a6b0c5}}`

/**
 * 生成只读分享页
 * @param {{ title: string, categories: object[], sites: object[], exportedAt?: string }} data
 * @returns {string} 完整 HTML 文本
 */
export function buildSharePage({ title, categories = [], sites = [], exportedAt }) {
  const byCategory = new Map()
  for (const site of sites) {
    const key = site.categoryId || null
    const bucket = byCategory.get(key)
    if (bucket) bucket.push(site)
    else byCategory.set(key, [site])
  }

  const section = (cat, depth) => {
    const list = byCategory.get(cat.id) || []
    const kids = (cat.children || []).map((child) => section(child, depth + 1)).join('')
    if (!list.length && !kids) return ''
    const heading = depth === 0 ? 'h2' : 'h3'
    const cards = list.map(cardHtml).filter(Boolean).join('')
    return `<section><${heading}><s>${escapeHtml(cat.icon || '')}</s>${escapeHtml(cat.name)}</${heading}>
<ul>${cards}</ul></section>${kids}`
  }

  const body = categories.map((cat) => section(cat, 0)).join('')
  const uncategorized = (byCategory.get(null) || []).map(cardHtml).filter(Boolean).join('')
  const uncatBlock = uncategorized ? `<section><h2>未分类</h2><ul>${uncategorized}</ul></section>` : ''
  const done = exportedAt || new Date().toISOString().slice(0, 10)
  const count = sites.length

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title || 'Nav-AI')}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<h1>${escapeHtml(title || 'Nav-AI')}</h1>
<p class="tip">共 ${count} 个站点｜导出于 ${escapeHtml(done)}｜本页为只读分享版，数据已内联，可直接转发或用浏览器打开。</p>
${body}${uncatBlock}
<footer>由 Nav-AI 导出的只读页面</footer>
</div>
</body>
</html>
`
}
