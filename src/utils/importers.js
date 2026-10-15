/**
 * 批量导入解析（纯函数，零依赖）：
 *  - parseSiteLines：逐行解析「名称 + 网址」文本（批量添加）
 *  - parseBookmarksHTML：解析浏览器导出的书签 HTML（Netscape 格式），按文件夹还原分类路径
 */

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
