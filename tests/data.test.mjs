/**
 * 数据层单元测试（Node 内置测试运行器，零依赖）：
 *   npm test        或        node --test tests/
 *
 * data.js 在模块作用域读取 localStorage / window.matchMedia / document，
 * 因此这里先注入最小桩件，再动态 import 被测模块。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

/* ---------------- 运行环境桩件 ---------------- */

const storage = new Map()
/** 模拟写入失败（配额超限） */
let failWrites = false

globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => {
    if (failWrites) throw new Error('QuotaExceededError')
    storage.set(k, String(v))
  },
  removeItem: (k) => storage.delete(k),
}
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
}
/** document 桩：applyTheme / applyAccent 只写 dataset */
const doc = { documentElement: { dataset: {} } }
globalThis.document = new Proxy(doc, {
  get: (target, key) => (key in target ? target[key] : () => ({ content: {}, style: {}, setAttribute() {} })),
})

const { nextTick } = await import('vue')
const data = await import('../src/store/data.js')
const {
  store,
  DATA_VERSION,
  normalizeData,
  migrate,
  exportJSON,
  importJSON,
  importSites,
  resetData,
  addSite,
  updateSite,
  removeSite,
  restoreSite,
  moveSitesTo,
  removeSites,
  restoreSites,
  moveSite,
  moveSiteRelative,
  sitesOf,
  addCategory,
  renameCategory,
  moveCategory,
  removeCategory,
  restoreCategory,
  findCategory,
  applyAppearance,
  applyExternalData,
  captureSnapshot,
  restoreSnapshot,
  flushPersist,
  storageWarning,
} = data

// 模拟 main.js 的首屏外观应用（模块自身只在数据变化时驱动 DOM）
applyAppearance()

/** 每个用例从默认数据开始（flush 掉节流中的写入，避免定时器跨用例残留） */
async function fresh() {
  resetData()
  await nextTick()
  flushPersist()
}

/* ---------------- 迁移（B2） ---------------- */

test('migrate：v1 → 当前版本补齐 settings 新字段，且不覆盖已有值', () => {
  const out = migrate({ version: 1, settings: { title: '旧标题', theme: 'dark' }, categories: [], sites: [] })
  assert.equal(out.version, DATA_VERSION)
  assert.equal(out.settings.title, '旧标题')
  assert.equal(out.settings.theme, 'dark')
  assert.equal(out.settings.iconSource, 'auto')
  assert.equal(out.settings.accent, 'default')
  assert.equal(out.settings.density, 'comfortable')
  assert.equal(out.settings.showDesc, true)
})

test('migrate：v2 数据链式迁移到当前版本，且重复迁移幂等', () => {
  const v2 = { version: 2, settings: { title: 'T', theme: 'light', accent: 'ocean' }, categories: [], sites: [] }
  const out = migrate(v2)
  assert.equal(out.version, DATA_VERSION)
  assert.equal(out.settings.accent, 'ocean', '已有主色不应被覆盖')
  assert.equal(out.settings.density, 'comfortable')
  assert.equal(out.settings.showDesc, true)
  assert.deepEqual(migrate(out), out)
})

test('migrate：v3 → v4 为站点补齐置顶与使用统计默认值', () => {
  const out = migrate({
    version: 3,
    settings: {},
    categories: [],
    sites: [
      { id: 's1', name: 'S1', url: 'https://s1.example' },
      { id: 's2', name: 'S2', url: 'https://s2.example', pinned: true, visits: 3, tags: ['x'] },
    ],
  })
  assert.equal(out.version, DATA_VERSION)
  assert.equal(out.sites[0].pinned, false)
  assert.equal(out.sites[0].visits, 0)
  assert.equal(out.sites[0].lastVisited, 0)
  assert.deepEqual(out.sites[0].tags, [])
  assert.equal(out.sites[1].pinned, true, '已有值不应被默认值覆盖')
  assert.equal(out.sites[1].visits, 3)
  assert.deepEqual(out.sites[1].tags, ['x'])
  assert.deepEqual(migrate(out), out, '当前版本数据再迁移应幂等')
})

test('migrate：无版本字段按 1 处理，且对当前版本数据幂等', () => {
  const legacy = migrate({ categories: [], sites: [] })
  assert.equal(legacy.version, DATA_VERSION)
  const again = migrate(legacy)
  assert.deepEqual(again, legacy)
})

/* ---------------- 归一化（A4） ---------------- */

test('normalizeData：补字段、去非法、id 去重、两级截断、失效分类归位', () => {
  const clean = normalizeData({
    settings: { title: '  我的导航  ', theme: 'weird', accent: '不存在的色', iconSource: 'x' },
    categories: [
      { id: 'c1', name: 'A', children: [{ id: 'c2', name: 'A1', children: [{ id: 'c3', name: 'A1a' }] }] },
      { id: 'c1', name: '重复 id' },
      { name: '无 id' },
      { name: '', icon: 'x' },
      null,
    ],
    sites: [
      { id: 's1', name: '站点1', url: 'https://a.com', categoryId: 'c2' },
      { name: '站点2', categoryId: 'ghost' },
      { id: 's1', name: '重复 id 站点', categoryId: null },
      { name: '   ' },
      'junk',
    ],
  })
  assert.equal(clean.settings.title, '我的导航')
  assert.equal(clean.settings.theme, 'auto')
  assert.equal(clean.settings.accent, 'default')
  assert.equal(clean.settings.iconSource, 'auto')
  assert.equal(clean.categories.length, 3)
  assert.equal(clean.categories[0].children[0].children.length, 0, '第三级应被截断')
  assert.equal(new Set(clean.categories.map((c) => c.id)).size, 3, '分类 id 应唯一')
  assert.equal(clean.sites.length, 3)
  assert.equal(clean.sites[0].categoryId, 'c2')
  assert.equal(clean.sites[1].categoryId, null)
  assert.equal(clean.moved, 1)
})

test('normalizeData：非 http(s) 协议一律置空，伪协议无法进入卡片链接', () => {
  const clean = normalizeData({
    categories: [{ id: 'c1', name: 'C' }],
    sites: [
      { name: '正常', url: 'https://ok.example/path' },
      { name: '脚本', url: 'javascript:alert(1)' },
      { name: '数据', url: 'data:text/html,<script>alert(1)</script>' },
      { name: '相对路径', url: '/relative' },
      { name: '空白', url: '   ' },
    ],
  })
  assert.deepEqual(
    clean.sites.map((s) => s.url),
    ['https://ok.example/path', '', '', '', ''],
    '只有 http(s) 可以落库，其余统一置空'
  )
})

test('normalizeData：置顶/统计/标签字段做类型兜底与去重', () => {
  const clean = normalizeData({
    categories: [],
    sites: [
      {
        name: 'A',
        url: 'https://a.example',
        pinned: 'yes',
        visits: -3,
        lastVisited: 'x',
        tags: ['x', 'x', 2, ' y ', ''],
      },
    ],
  })
  const site = clean.sites[0]
  assert.equal(site.pinned, false, '非 true 一律视为未置顶')
  assert.equal(site.visits, 0, '负数应归零')
  assert.equal(site.lastVisited, 0, '非数字应归零')
  assert.deepEqual(site.tags, ['x', 'y'], '标签应去空、去重并 trim')
})

/* ---------------- 导入导出 ---------------- */

test('captureSnapshot / restoreSnapshot：覆盖式导入可完整回滚', async () => {
  await fresh()
  const siteCount = store.sites.length
  const catCount = store.categories.length
  const snapshot = captureSnapshot()

  importJSON(
    JSON.stringify({
      categories: [{ id: 'only', name: '唯一分类' }],
      sites: [{ name: '唯一站点', url: 'https://only.example', categoryId: 'only' }],
    })
  )
  assert.equal(store.sites.length, 1)
  assert.equal(store.categories.length, 1)

  assert.equal(restoreSnapshot(snapshot), true)
  assert.equal(store.sites.length, siteCount)
  assert.equal(store.categories.length, catCount)
  assert.ok(store.sites.some((s) => s.name === 'GitHub'), '站点内容应完整还原')
  assert.equal(restoreSnapshot(null), false, '空快照应安全返回 false')
})

test('importJSON：拒绝高于当前版本的数据，避免静默丢字段', () => {
  assert.throws(
    () => importJSON(JSON.stringify({ version: DATA_VERSION + 1, categories: [], sites: [] })),
    /高于当前应用支持/
  )
})

test('importJSON：归一化 + 统计返回，且导出可往返', () => {
  const res = importJSON(
    JSON.stringify({
      version: 1,
      categories: [{ id: 'k1', name: 'K' }],
      sites: [
        { id: 'p1', name: 'P', url: 'https://p.com', categoryId: 'missing' },
        { id: 'p2', name: 'Q', url: 'https://q.com', categoryId: 'k1' },
      ],
    })
  )
  assert.deepEqual(res, { categories: 1, sites: 2, moved: 1 })
  assert.equal(sitesOf('k1').length, 1)
  assert.equal(sitesOf(null).length, 1)

  const dumped = JSON.parse(exportJSON())
  assert.equal(dumped.version, DATA_VERSION)
  assert.equal(dumped.sites.length, 2)
  const again = importJSON(exportJSON())
  assert.deepEqual(again, { categories: 1, sites: 2, moved: 0 })
})

test('importJSON：缺字段时报错', () => {
  assert.throws(() => importJSON('{"sites":[]}'), /数据格式不正确/)
})

/* ---------------- 站点操作 ---------------- */

test('站点 CRUD 与顺序调整', async () => {
  await fresh()
  const media = sitesOf('cat-media')
  const before = media.map((s) => s.name)
  assert.equal(before.length, 2)

  // 同分类内下移 / 上移
  assert.equal(moveSite(media[0].id, 1), true, '同分类内下移应成功')
  assert.deepEqual(sitesOf('cat-media').map((s) => s.name), [...before].reverse())
  assert.equal(moveSite(sitesOf('cat-media')[0].id, 1), true, '再移回去')
  assert.deepEqual(sitesOf('cat-media').map((s) => s.name), before)

  // 边界与跨分类隔离：首个上移 / 末个下移都不应移动（不与其它分类的站点交换）
  assert.equal(moveSite(sitesOf('cat-media')[0].id, -1), false, '已是首个时不应移动')
  assert.equal(moveSite(sitesOf('cat-media')[1].id, 1), false, '已是末个时不应移动')
  assert.deepEqual(sitesOf('cat-media').map((s) => s.name), before, '边界操作不应改变顺序')

  addSite({ name: '新站点', url: 'https://new.example', desc: '', icon: '', categoryId: 'cat-media' })
  assert.equal(sitesOf('cat-media').length, 3)

  const added = sitesOf('cat-media')[2]
  assert.equal(added.pinned, false, '新站点默认不置顶')
  assert.equal(added.visits, 0)
  assert.equal(added.lastVisited, 0)
  assert.deepEqual(added.tags, [], '新站点默认无标签')

  const target = sitesOf('cat-media')[2]
  updateSite(target.id, { name: '改名后' })
  assert.equal(sitesOf('cat-media')[2].name, '改名后')

  const snapshot = removeSite(target.id)
  assert.equal(sitesOf('cat-media').length, 2)
  restoreSite(snapshot.site, snapshot.index)
  assert.equal(sitesOf('cat-media').length, 3)
  assert.equal(sitesOf('cat-media')[2].name, '改名后', '撤销应回到原位置')

  // 新建时显式传入的置顶/标签不能被工厂默认值覆盖
  addSite({
    name: '置顶站点',
    url: 'https://pin.example',
    categoryId: 'cat-media',
    pinned: true,
    tags: ['置顶'],
  })
  const pinnedSite = sitesOf('cat-media').find((s) => s.name === '置顶站点')
  assert.equal(pinnedSite.pinned, true)
  assert.deepEqual(pinnedSite.tags, ['置顶'])
})

test('moveSiteRelative：同分类排序 + 跨分类拖拽即移动分类', async () => {
  await fresh()
  const daily = sitesOf('cat-daily')
  const doc = sitesOf('cat-doc')
  assert.equal(moveSiteRelative(daily[1].id, daily[0].id, false), true)
  assert.equal(sitesOf('cat-daily')[0].id, daily[1].id, '插到目标之前')

  assert.equal(moveSiteRelative(daily[1].id, doc[0].id, true), true)
  assert.equal(sitesOf('cat-doc').length, 3)
  assert.equal(sitesOf('cat-doc')[1].id, daily[1].id, '插到目标之后')
  assert.equal(sitesOf('cat-doc')[1].categoryId, 'cat-doc', '应跟随目标分类')
  assert.equal(moveSiteRelative('不存在', doc[0].id), false)
})

/* ---------------- 分类操作 ---------------- */

test('分类增删改与排序，删除返回可撤销快照', async () => {
  await fresh()
  const top = addCategory('新分类', '🧪')
  const child = addCategory('子分类', '', top.id)
  assert.equal(findCategory(top.id).node.children.length, 1)

  renameCategory(child.id, '改名子分类', '🔧')
  assert.equal(findCategory(child.id).node.name, '改名子分类')

  const indexBefore = findCategory(top.id).index
  assert.equal(moveCategory(top.id, -1), true)
  assert.equal(findCategory(top.id).index, indexBefore - 1, '移动后索引应即时刷新')

  const snapshot = removeCategory('cat-dev')
  assert.equal(snapshot.movedSites.length, 4, '开发社区下 4 个站点应移入未分类')
  assert.equal(findCategory('cat-dev'), null)
  assert.equal(sitesOf(null).length, 4)

  restoreCategory(snapshot)
  assert.ok(findCategory('cat-dev'), '分类应被还原')
  assert.equal(sitesOf('cat-dev-en').length, 2, '站点应回到原子分类')
  assert.equal(sitesOf(null).length, 0)
})

/* ---------------- 批量导入（F4） ---------------- */

test('importSites：按 URL 去重、支持固定分类与书签路径建分类', async () => {
  await fresh()
  const fixed = importSites(
    [
      { name: 'GPT', url: 'https://chat.openai.com' },
      { name: '重复', url: 'https://chat.openai.com/' },
      { name: '空', url: '' },
    ],
    'cat-ai'
  )
  assert.deepEqual(fixed, { added: 1, skipped: 2, categories: 0 })
  assert.equal(sitesOf('cat-ai').length, 3)

  const withPaths = importSites([
    { name: 'A', url: 'https://a.example', categoryPath: ['书签栏', '技术'] },
    { name: 'B', url: 'https://b.example', categoryPath: ['书签栏', '技术'] },
    { name: 'C', url: 'https://c.example', categoryPath: ['书签栏', '设计'] },
    { name: 'D', url: 'https://d.example' },
    { name: 'GitHub 副本', url: 'https://www.github.com/' },
  ])
  assert.equal(withPaths.added, 4)
  assert.equal(withPaths.categories, 3, '书签栏 + 两个子分类')
  assert.equal(withPaths.skipped, 1, 'github.com 去重命中')
  const top = store.categories.find((c) => c.name === '书签栏')
  assert.ok(top && top.children.length === 2)
  assert.equal(sitesOf(top.children[0].id).length, 2)
})

/* ---------------- 多标签同步（A6） ---------------- */

test('applyExternalData：v3 数据同步后补齐 v4 站点字段', async () => {
  await fresh()
  const legacy = {
    version: 3,
    settings: { title: '旧数据' },
    categories: [{ id: 'c1', name: 'C' }],
    sites: [{ id: 's1', name: 'S1', url: 'https://s1.example', categoryId: 'c1' }],
  }
  assert.equal(applyExternalData(JSON.stringify(legacy)), true)
  const site = store.sites.find((s) => s.id === 's1')
  assert.equal(site.pinned, false)
  assert.equal(site.visits, 0)
  assert.equal(site.lastVisited, 0)
  assert.deepEqual(site.tags, [])
})

test('applyExternalData：内容一致短路，内容不同则替换', async () => {
  await fresh()
  assert.equal(applyExternalData(JSON.stringify(store)), false, '内容一致应短路')
  assert.equal(applyExternalData('{ 坏数据'), false, '无法解析不应抛错')

  const next = JSON.parse(JSON.stringify(store))
  next.sites.push({ id: 'ext-1', name: '外部站点', url: 'https://ext.example', desc: '', icon: '', categoryId: null })
  assert.equal(applyExternalData(JSON.stringify(next)), true)
  assert.ok(store.sites.some((s) => s.id === 'ext-1'))
  assert.equal(applyExternalData(JSON.stringify(next)), false, '重复投递应短路')
})

/* ---------------- 外观（主题 / 主色） ---------------- */

test('导入数据后主题与主色立即落到 DOM', async () => {
  importJSON(
    JSON.stringify({
      categories: [],
      sites: [],
      settings: { title: 'T', theme: 'dark', accent: 'ocean' },
    })
  )
  await nextTick()
  assert.equal(doc.documentElement.dataset.theme, 'dark')
  assert.equal(doc.documentElement.dataset.accent, 'ocean')

  resetData()
  await nextTick()
  assert.equal(doc.documentElement.dataset.theme, 'light')
  assert.equal(doc.documentElement.dataset.accent, 'default')
})

test('密度与标题：设置变化后同步到 DOM 与文档标题', async () => {
  await fresh()
  assert.equal(doc.documentElement.dataset.density, 'comfortable')
  assert.equal(doc.title, 'Nav-AI')

  store.settings.density = 'compact'
  store.settings.title = '我的导航'
  await nextTick()
  assert.equal(doc.documentElement.dataset.density, 'compact')
  assert.equal(doc.title, '我的导航')

  // 非法密度在归一化时回落默认值
  const clean = normalizeData({ settings: { density: '乱填' }, categories: [], sites: [] })
  assert.equal(clean.settings.density, 'comfortable')
  assert.equal(normalizeData({ settings: { showDesc: false }, categories: [], sites: [] }).settings.showDesc, false)
})

/* ---------------- 批量管理（F6） ---------------- */

test('批量移动 / 批量删除 / 整批撤销', async () => {
  await fresh()
  const ids = sitesOf('cat-media').map((s) => s.id)
  assert.equal(moveSitesTo(ids, 'cat-ai'), 2)
  assert.equal(sitesOf('cat-media').length, 0)
  assert.equal(sitesOf('cat-ai').length, 4)

  const snapshots = removeSites(sitesOf('cat-ai').map((s) => s.id))
  assert.equal(snapshots.length, 4)
  assert.equal(sitesOf('cat-ai').length, 0)
  assert.ok(snapshots.every((s) => typeof s.index === 'number'))

  restoreSites(snapshots)
  assert.equal(sitesOf('cat-ai').length, 4, '撤销后应回到原分类')
  assert.deepEqual(removeSites(['不存在']), [])
})

/* ---------------- 存储异常（B1） ---------------- */

test('写入失败产生提示，恢复后自动清除', async () => {
  await fresh()
  assert.equal(storageWarning.value, '')
  failWrites = true
  addSite({ name: '写不进去', url: 'https://x.example', desc: '', icon: '', categoryId: null })
  await nextTick()
  flushPersist()
  assert.ok(storageWarning.value)
  failWrites = false
  addSite({ name: '可以写了', url: 'https://y.example', desc: '', icon: '', categoryId: null })
  await nextTick()
  flushPersist()
  assert.equal(storageWarning.value, '')
})
