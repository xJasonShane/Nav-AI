/**
 * 视图纯函数单元测试（零依赖，`node --test`）：
 * 搜索过滤、分组装配、分类扁平化、分享页生成（含转义与伪协议过滤）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filterSites } from '../src/utils/search.js'
import { buildGroups, flattenCategories } from '../src/utils/grouping.js'
import { buildSharePage, escapeHtml } from '../src/utils/export-page.js'
import { isHttpUrl, isValidHttpUrl, safeHttpUrl, urlKey } from '../src/utils/url.js'
import { backupToEntries, parseSiteLines, previewMerge } from '../src/utils/importers.js'
import { buildBookmarksHTML } from '../src/utils/export-bookmarks.js'

const SITES = [
  { id: 's1', name: 'GitHub', desc: '代码托管', url: 'https://github.com', categoryId: 'c1' },
  { id: 's2', name: '掘金', desc: '中文技术社区', url: 'https://juejin.cn', categoryId: 'c1' },
  { id: 's3', name: 'MDN', desc: '', url: 'https://developer.mozilla.org', categoryId: 'c2' },
  { id: 's4', name: '未分类站点', desc: '', url: 'https://loose.example', categoryId: null },
]

const CATEGORIES = [
  { id: 'c1', name: '开发', icon: '💻', children: [{ id: 'c1a', name: '国内', icon: '', children: [] }] },
  { id: 'c2', name: '文档', icon: '', children: [] },
]

const sitesOf = (categoryId) => SITES.filter((s) => (s.categoryId || null) === (categoryId || null))
const findNode = (id) => CATEGORIES.find((c) => c.id === id) || null

test('filterSites：空查询返回空数组，命中名称/描述/网址，忽略大小写', () => {
  assert.deepEqual(filterSites(SITES, ''), [])
  assert.deepEqual(filterSites(SITES, '   '), [])
  assert.deepEqual(filterSites(SITES, 'github').map((s) => s.id), ['s1'])
  assert.deepEqual(filterSites(SITES, '技术').map((s) => s.id), ['s2'])
  assert.deepEqual(filterSites(SITES, 'MOZILLA').map((s) => s.id), ['s3'])
  assert.deepEqual(filterSites(SITES, '不存在'), [])
})

test('filterSites：相关性排序 + 分类名命中 + 同分保持原顺序', () => {
  const sites = [
    { id: 'a', name: '数据结构', desc: '', url: 'https://a.example', categoryId: 'c1' },
    { id: 'b', name: 'GitHub 教程', desc: '代码托管', url: 'https://b.example', categoryId: 'c2' },
    { id: 'c', name: '开发工具', desc: 'GitHub 客户端', url: 'https://c.example', categoryId: 'c2' },
  ]
  const names = new Map([
    ['c1', '设计'],
    ['c2', '工具'],
  ])

  assert.deepEqual(
    filterSites(sites, 'git').map((s) => s.id),
    ['b', 'c'],
    '名称前缀命中应排在描述命中之前'
  )

  assert.deepEqual(filterSites(sites, '设计', names).map((s) => s.id), ['a'], '分类名可被搜索命中')
  assert.deepEqual(
    filterSites(sites, '工具', names).map((s) => s.id),
    ['c', 'b'],
    '名称命中(80)优先于分类名命中(60)'
  )

  const loose = [{ id: 'u', name: '松散', desc: '', url: 'https://u.example', categoryId: null }]
  assert.deepEqual(
    filterSites(loose, '未分类', new Map([[null, '未分类']])).map((s) => s.id),
    ['u'],
    '未分类站点可通过 null 映射命中'
  )

  const sameScore = [
    { id: 'x', name: '导航', desc: '工具集', url: 'https://x.example', categoryId: null },
    { id: 'y', name: '导航站', desc: '工具集', url: 'https://y.example', categoryId: null },
  ]
  assert.deepEqual(
    filterSites(sameScore, '工具').map((s) => s.id),
    ['x', 'y'],
    '同分时保持数据原顺序'
  )

  const tagged = [{ id: 't', name: 'X', desc: '', url: 'https://x.example', tags: ['AI 工具'] }]
  assert.deepEqual(filterSites(tagged, 'ai').map((s) => s.id), ['t'], '标签参与搜索')
})

test('isValidHttpUrl：只接受带域名或 IP 的 http(s) 地址', () => {
  assert.equal(isValidHttpUrl('https://example.com'), true)
  assert.equal(isValidHttpUrl('http://192.168.1.1:8080/path'), true)
  assert.equal(isValidHttpUrl('https://localhost:3000'), true)
  assert.equal(isValidHttpUrl('https://foo'), false, '缺少域名后缀的地址应被拒绝')
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false)
  assert.equal(isValidHttpUrl(''), false)
})

test('buildGroups：全部 / 未分类 / 指定分类 / 失效分类', () => {
  const all = buildGroups({ categories: CATEGORIES, sitesOf, selectedId: null, findNode })
  assert.equal(all.length, 3, '「全部分类」应包含未分类分组')
  assert.equal(all[0].title, '开发')
  assert.equal(all[0].icon, '💻')
  assert.equal(all[0].sites.length, 2)
  assert.equal(all[0].children.length, 1)
  assert.equal(all[0].children[0].icon, '📂', '子分类缺图标时用默认 emoji')
  assert.equal(all[1].icon, '📁', '顶级分类缺图标时用默认 emoji')
  assert.equal(all[2].key, 'uncat')
  assert.equal(all[2].title, '未分类')
  assert.deepEqual(all[2].sites.map((s) => s.id), ['s4'], '未分类站点必须出现在全部视图末尾')

  const noUncategorized = buildGroups({
    categories: CATEGORIES,
    sitesOf: (id) => (id === null ? [] : sitesOf(id)),
    selectedId: null,
    findNode,
  })
  assert.equal(noUncategorized.length, 2, '没有未分类站点时不追加空分组')

  const uncategorized = buildGroups({ categories: CATEGORIES, sitesOf, selectedId: 'uncategorized', findNode })
  assert.equal(uncategorized.length, 1)
  assert.equal(uncategorized[0].title, '未分类')
  assert.deepEqual(uncategorized[0].sites.map((s) => s.id), ['s4'])

  const one = buildGroups({ categories: CATEGORIES, sitesOf, selectedId: 'c1', findNode })
  assert.equal(one.length, 1)
  assert.equal(one[0].key, 'c1')

  assert.deepEqual(buildGroups({ categories: CATEGORIES, sitesOf, selectedId: 'ghost', findNode }), [], '失效分类返回空')

  const noCategories = buildGroups({ categories: [], sitesOf, selectedId: null, findNode })
  assert.equal(noCategories.length, 1, '分类被删光时仍应展示未分类站点，而不是留白')
  assert.equal(noCategories[0].key, 'uncat')
  assert.deepEqual(
    buildGroups({ categories: [], sitesOf: () => [], selectedId: null, findNode }),
    [],
    '完全没有站点时返回空数组（由上层空状态兜底）'
  )
})

test('buildGroups：置顶优先 + 最近打开 / 最常访问虚拟视图', () => {
  const list = [
    { id: 'a', name: 'A', pinned: false, categoryId: 'c1', lastVisited: 100, visits: 2 },
    { id: 'b', name: 'B', pinned: true, categoryId: 'c1', lastVisited: 300, visits: 5 },
    { id: 'c', name: 'C', pinned: false, categoryId: 'c1', lastVisited: 0, visits: 0 },
  ]
  const cats = [{ id: 'c1', name: 'C1', children: [] }]
  const of = (id) => (id === 'c1' ? list : [])

  const pinned = buildGroups({ categories: cats, sitesOf: of, selectedId: 'c1', pinnedFirst: true })
  assert.deepEqual(pinned[0].sites.map((s) => s.id), ['b', 'a', 'c'], '置顶站点排在最前')
  assert.deepEqual(list.map((s) => s.id), ['a', 'b', 'c'], '不得修改原数组顺序')

  const plain = buildGroups({ categories: cats, sitesOf: of, selectedId: 'c1', pinnedFirst: false })
  assert.deepEqual(plain[0].sites.map((s) => s.id), ['a', 'b', 'c'], '排序模式按原顺序')

  const recent = buildGroups({ categories: [], sitesOf: () => [], selectedId: 'recent', allSites: list })
  assert.equal(recent[0].title, '最近打开')
  assert.deepEqual(recent[0].sites.map((s) => s.id), ['b', 'a'], '按最近访问时间倒序，过滤未访问')

  const frequent = buildGroups({ categories: [], sitesOf: () => [], selectedId: 'frequent', allSites: list })
  assert.equal(frequent[0].title, '最常访问')
  assert.deepEqual(frequent[0].sites.map((s) => s.id), ['b', 'a'], '按访问次数倒序')
})

test('flattenCategories：两级展开且带 depth，供下拉选择使用', () => {
  const flat = flattenCategories(CATEGORIES)
  assert.deepEqual(flat.map((o) => [o.id, o.depth]), [['c1', 0], ['c1a', 1], ['c2', 0]])
  assert.equal(flat[0].icon, '💻')
  assert.equal(flat[1].icon, '')
  assert.deepEqual(flattenCategories(undefined), [])
})

test('escapeHtml：转义全部危险字符', () => {
  assert.equal(escapeHtml(`<img src="x" onerror='1'>&`), '&lt;img src=&quot;x&quot; onerror=&#39;1&#39;&gt;&amp;')
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
})

test('buildSharePage：自包含、零外部资源、过滤伪协议、数据转义', () => {
  const sites = [
    ...SITES,
    { id: 'xss', name: '</script><script>alert(1)</script>', desc: '恶意名称', url: 'https://evil.example', categoryId: 'c1' },
    { id: 'proto', name: '伪协议站点', desc: '应被丢弃', url: 'javascript:alert(1)', categoryId: 'c1' },
  ]
  const html = buildSharePage({ title: '我的导航', categories: CATEGORIES, sites, exportedAt: '2026-10-15' })

  assert.ok(html.startsWith('<!DOCTYPE html>'))
  assert.ok(html.includes('<title>我的导航</title>'))
  assert.ok(html.includes('共 6 个站点'), '站点总数应计入')
  assert.ok(!html.includes('<script'), '不应包含任何脚本标签')
  assert.ok(!html.includes('javascript:'), '伪协议链接应被丢弃')
  assert.ok(!html.includes('</script><script>alert(1)'), '恶意名称应被转义')
  assert.ok(html.includes('&lt;/script&gt;'), '转义后的名称仍应展示')
  assert.ok(!/https?:\/\/(?!github|juejin|developer|loose|evil)/.test(html), '除站点链接外不应引用外部资源')
  assert.ok(html.includes('未分类'), '未分类站点应单独成组')
  assert.ok(html.includes('prefers-color-scheme:dark'), '分享页应跟随系统深色')
})

test('backupToEntries + previewMerge：合并导入的路径转换与预估', () => {
  const backup = {
    categories: [
      { id: 'c1', name: '开发', children: [{ id: 'c1a', name: '国内', children: [] }] },
      { id: 'c2', name: '文档', children: [] },
    ],
    sites: [
      { name: 'A', url: 'https://a.example', categoryId: 'c1a' },
      { name: '伪协议', url: 'javascript:alert(1)', categoryId: 'c1' },
      { name: 'C', url: 'https://c.example', categoryId: null },
    ],
  }
  const entries = backupToEntries(backup)
  assert.equal(entries.length, 2, '非 http(s) 站点应被过滤')
  assert.deepEqual(entries[0].categoryPath, ['开发', '国内'])
  assert.deepEqual(entries[1].categoryPath, [], '未分类站点路径为空')

  const stats = previewMerge(
    [{ id: 'x', name: '开发', children: [{ id: 'x1', name: '国际', children: [] }] }],
    [{ url: 'https://c.example' }],
    entries
  )
  assert.equal(stats.added, 1, '只新增 a.example')
  assert.equal(stats.skipped, 1, 'c.example 已存在应跳过')
  assert.equal(stats.categories, 1, '「开发」已存在，只新建「国内」')
})

test('buildBookmarksHTML：两层文件夹、转义与伪协议过滤', () => {
  const html = buildBookmarksHTML({
    categories: [
      { id: 'c1', name: '开发', children: [{ id: 'c1a', name: '国内', children: [] }] },
      { id: 'c2', name: '空分类', children: [] },
    ],
    sites: [
      { name: 'GitHub', url: 'https://github.com', categoryId: 'c1a' },
      { name: '<script>', url: 'https://evil.example', categoryId: 'c1' },
      { name: '伪协议', url: 'javascript:alert(1)', categoryId: 'c1' },
      { name: '散落', url: 'https://loose.example', categoryId: null },
    ],
  })

  assert.ok(html.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>'))
  assert.ok(html.includes('<DT><H3>开发</H3>'))
  assert.ok(html.includes('<DT><H3>国内</H3>'))
  assert.ok(html.includes('HREF="https://github.com"'))
  assert.ok(!html.includes('javascript:'), '伪协议站点应被丢弃')
  assert.ok(html.includes('&lt;script&gt;'), '站点名称应转义')
  assert.ok(html.includes('未分类'), '未分类站点单独成夹')
  assert.ok(!html.includes('空分类'), '空分类不导出')
})


test('safeHttpUrl / urlKey：空 host 拒绝，去重键忽略协议与 www', () => {
  assert.equal(safeHttpUrl('https://'), '')
  assert.equal(safeHttpUrl('https://?x=1'), '')
  assert.equal(safeHttpUrl('javascript:alert(1)'), '')
  assert.equal(safeHttpUrl('http://localhost:3000'), 'http://localhost:3000')
  assert.equal(isHttpUrl('https://'), false)
  assert.equal(urlKey('http://example.com'), urlKey('https://www.example.com/'))
})

test('parseSiteLines：三种写法、注释与无效行', () => {
  const entries = parseSiteLines(`
https://github.com
GitHub https://github.com
掘金|https://juejin.cn
# 这是注释
不是网址
a.com
`)
  assert.deepEqual(entries, [
    { name: '', url: 'https://github.com' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: '掘金', url: 'https://juejin.cn' },
    { name: '', url: 'https://a.com' },
  ])
})

test('buildGroups：标签过滤只保留命中站点与有命中的分组', () => {
  const list = [
    { id: 'a', name: 'A', categoryId: 'c1', tags: ['AI', '工具'], lastVisited: 10, visits: 1 },
    { id: 'b', name: 'B', categoryId: 'c1', tags: ['工具'] },
    { id: 'c', name: 'C', categoryId: 'c2', tags: ['AI'], lastVisited: 20, visits: 2 },
    { id: 'd', name: 'D', categoryId: null, tags: [] },
  ]
  const cats = [
    { id: 'c1', name: 'C1', children: [{ id: 'c1a', name: 'C1A', children: [] }] },
    { id: 'c2', name: 'C2', children: [] },
  ]
  const of = (id) => list.filter((site) => (site.categoryId || null) === (id || null))

  const groups = buildGroups({ categories: cats, sitesOf: of, selectedId: null, tag: 'AI' })
  assert.deepEqual(groups.map((g) => g.key), ['c1', 'c2'], '没有命中的未分类/子分类应被移除')
  assert.deepEqual(groups[0].sites.map((s) => s.id), ['a'])
  assert.deepEqual(groups[0].children, [], '空子分类不应留下')
  assert.deepEqual(groups[1].sites.map((s) => s.id), ['c'])

  assert.deepEqual(buildGroups({ categories: cats, sitesOf: of, selectedId: 'c1', tag: '工具' })[0].sites.map((s) => s.id), ['a', 'b'])
  assert.deepEqual(buildGroups({ categories: cats, sitesOf: of, selectedId: 'c1a', tag: 'AI' }), [], '子分类无命中时返回空')
  assert.deepEqual(buildGroups({ categories: cats, sitesOf: of, selectedId: 'recent', allSites: list, tag: 'AI' })[0].sites.map((s) => s.id), ['c', 'a'])
  assert.deepEqual(buildGroups({ categories: cats, sitesOf: of, selectedId: 'frequent', allSites: list, tag: '工具' })[0].sites.map((s) => s.id), ['a'])
})
