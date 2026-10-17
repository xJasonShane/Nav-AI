/**
 * 导出浏览器书签 HTML（Netscape Bookmark 格式，纯函数）。
 * 两层分类映射为文件夹嵌套；未分类站点归入根级「未分类」文件夹。
 * 只导出 http(s) 站点，文本统一经过 HTML 转义。
 */
import { escapeHtml } from './export-page.js'
import { safeHttpUrl } from './url.js'

function linkHtml(site) {
  return `    <DT><A HREF="${escapeHtml(safeHttpUrl(site.url))}">${escapeHtml(site.name)}</A>`
}

/**
 * @param {{categories?: object[], sites?: object[]}} data
 * @returns {string} 完整的 Netscape 书签 HTML
 */
export function buildBookmarksHTML({ categories = [], sites = [] } = {}) {
  const byCategory = new Map()
  for (const site of sites) {
    if (!safeHttpUrl(site.url)) continue
    const key = site.categoryId || null
    const bucket = byCategory.get(key)
    if (bucket) bucket.push(site)
    else byCategory.set(key, [site])
  }

  const folder = (cat, depth) => {
    const own = (byCategory.get(cat.id) || []).map(linkHtml).join('\n')
    const kids = (cat.children || [])
      .map((child) => folder(child, depth + 1))
      .filter(Boolean)
      .join('\n')
    if (!own && !kids) return ''

    const indent = '    '.repeat(depth + 1)
    const inner = [own, kids].filter(Boolean).join('\n')
    return `${indent}<DT><H3>${escapeHtml(cat.name)}</H3>\n${indent}<DL><p>\n${inner}\n${indent}</DL><p>`
  }

  const body = categories
    .map((cat) => folder(cat, 0))
    .filter(Boolean)
    .join('\n')

  const loose = (byCategory.get(null) || []).map(linkHtml).join('\n')
  const looseBlock = loose ? `    <DT><H3>未分类</H3>\n    <DL><p>\n${loose}\n    </DL><p>` : ''

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${[body, looseBlock].filter(Boolean).join('\n')}
</DL><p>
`
}
