/**
 * 批量导入解析（纯函数，零依赖）：
 *  - parseSiteLines：逐行解析「名称 + 网址」文本（批量添加）
 *  - parseBookmarksHTML：解析浏览器导出的书签 HTML（Netscape 格式），按文件夹还原分类路径
 *  - backupToEntries / previewMerge：备份 JSON 合并导入的转换与预估（不修改数据）
 */
import { urlKey } from './url.js'

/** 补全协议：无 http(s) 前缀时按 https 处理 */
function withProtocol(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

/** 是否是像网址的一行（含点号且没有空格，或以协议开头） */
function looksLikeUrl(text) {
  const t = String(text || '').trim()
  if (!t || /\s/.test(t)) return false
  return /^https?:\/\//i.test(t) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(t)
}

/**
 * 解析批量添加文本：每行支持
 *   https://a.com
 *   名称 https://a.com
 *   名称|https://a.com
 * 不以「#」开头的空行会被忽略，无法识别为网址的行会被跳过。
 * @returns {{ name: string, url: string }[]}
 */
export function parseSiteLines(text) {
  const out = []
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    let name = ''
    let url = line
    if (line.includes('|')) {
      const [first, second] = line.split('|')
      if (second !== undefined && (looksLikeUrl(second) || /\./.test(second))) {
        name = first.trim()
        url = second.trim()
      } else {
        url = first.trim()
      }
    } else {
      const tokens = line.split(/\s+/)
      const last = tokens[tokens.length - 1]
      if (tokens.length > 1 && looksLikeUrl(last)) {
        name = tokens.slice(0, -1).join(' ')
        url = last
      }
    }
    if (!looksLikeUrl(url) && !/\./.test(url)) continue
    out.push({ name, url: withProtocol(url) })
  }
  return out
}

/**
 * 解析浏览器导出的书签 HTML（<DL><DT><H3>文件夹</H3>… / <DT><A HREF>站点</A>）。
 * 结构约定：文件夹层级取前两级作为「顶级分类 / 子分类」，更深的层级折叠进第二级。
 * @returns {{ name: string, url: string, categoryPath: string[] }[]}
 */
export function parseBookmarksHTML(text) {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(String(text || ''), 'text/html')
  const out = []

  const walk = (dl, path) => {
    for (const node of dl.children) {
      if (node.tagName !== 'DT') continue
      const folder = node.querySelector(':scope > H3')
      const link = node.querySelector(':scope > A')
      // 浏览器导出时 <DL> 可能嵌在 <DT> 内，也可能作为兄弟节点紧随其后
      const sub =
        node.querySelector(':scope > DL') ||
        (node.nextElementSibling?.tagName === 'DL' ? node.nextElementSibling : null)
      if (folder) {
        const nextPath = path.length >= 2 ? path : [...path, folder.textContent.trim() || '未命名']
        if (sub) walk(sub, nextPath)
        continue
      }
      if (link) {
        const url = link.getAttribute('HREF') || ''
        if (/^https?:\/\//i.test(url)) {
          out.push({ name: link.textContent.trim(), url, categoryPath: [...path] })
        }
      }
      if (sub) walk(sub, path)
    }
  }

  const root = doc.querySelector('DL')
  if (root) walk(root, [])
  return out
}

/**
 * 把备份 JSON 转成 importSites 可消费的条目：
 * 分类以「名称路径」表达，便于按名称与现有分类合并（而不是沿用备份里的分类 id）。
 * @param {{categories?: object[], sites?: object[]}} data
 * @returns {{name: string, url: string, categoryPath: string[]}[]}
 */
export function backupToEntries(data) {
  const paths = new Map()
  const walk = (list, prefix) => {
    for (const cat of list || []) {
      // 无 id 的分类无法与站点关联，跳过（其下站点会归入未分类）
      if (!cat || typeof cat.name !== 'string' || typeof cat.id !== 'string' || !cat.id) continue
      const path = [...prefix, cat.name.trim()].filter(Boolean)
      paths.set(cat.id, path.slice(0, 2))
      if (Array.isArray(cat.children)) walk(cat.children, path)
    }
  }
  walk(data?.categories, [])

  return (data?.sites || [])
    .filter(
      (site) =>
        site &&
        typeof site.name === 'string' &&
        site.name.trim() &&
        /^https?:\/\//i.test(String(site.url || ''))
    )
    .map((site) => ({
      name: site.name.trim(),
      url: String(site.url).trim(),
      categoryPath: paths.get(site.categoryId) || [],
    }))
}

/**
 * 预估合并结果（不修改任何数据）：去重与建分类规则与 importSites 保持一致。
 * @param {object[]} categories 现有分类树
 * @param {object[]} sites 现有站点
 * @param {{name?: string, url: string, categoryPath?: string[]}[]} entries
 * @returns {{added: number, skipped: number, categories: number}}
 */
export function previewMerge(categories, sites, entries) {
  const seen = new Set((sites || []).map((site) => urlKey(site.url)).filter(Boolean))
  const tops = new Set((categories || []).map((cat) => cat.name))
  const children = new Map()
  for (const cat of categories || []) {
    children.set(cat.name, new Set((cat.children || []).map((child) => child.name)))
  }

  let added = 0
  let skipped = 0
  let created = 0

  for (const entry of entries || []) {
    const key = urlKey(entry?.url)
    if (!key || seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    added += 1

    const names = (Array.isArray(entry.categoryPath) ? entry.categoryPath : [])
      .map((name) => String(name || '').trim())
      .filter(Boolean)
      .slice(0, 2)
    if (!names.length) continue

    if (!tops.has(names[0])) {
      tops.add(names[0])
      children.set(names[0], new Set())
      created += 1
    }
    if (names.length > 1) {
      const set = children.get(names[0]) || new Set()
      if (!set.has(names[1])) {
        set.add(names[1])
        children.set(names[0], set)
        created += 1
      }
    }
  }

  return { added, skipped, categories: created }
}
