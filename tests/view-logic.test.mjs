/**
 * 视图纯函数单元测试（零依赖，`node --test`）：
 * 搜索过滤、分组装配、分类扁平化、分享页生成（含转义与伪协议过滤）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filterSites } from '../src/utils/search.js'
import { buildGroups, flattenCategories } from '../src/utils/grouping.js'
import { buildSharePage, escapeHtml } from '../src/utils/export-page.js'
import { isValidHttpUrl } from '../src/utils/url.js'

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
})
