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
  moveSite,
  moveSiteRelative,
  sitesOf,
  addCategory,
  renameCategory,
  moveCategory,
  removeCategory,
  restoreCategory,
  findCategory,
  applyExternalData,
  storageWarning,
} = data

/** 每个用例从默认数据开始 */
async function fresh() {
  resetData()
  await nextTick()
}

/* ---------------- 迁移（B2） ---------------- */

test('migrate：v1 → 当前版本补齐 settings 新字段，且不覆盖已有值', () => {
  const out = migrate({ version: 1, settings: { title: '旧标题', theme: 'dark' }, categories: [], sites: [] })
  assert.equal(out.version, DATA_VERSION)
  assert.equal(out.settings.title, '旧标题')
  assert.equal(out.settings.theme, 'dark')
  assert.equal(out.settings.iconSource, 'auto')
  assert.equal(out.settings.accent, 'default')
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

/* ---------------- 导入导出 ---------------- */

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

  const target = sitesOf('cat-media')[2]
  updateSite(target.id, { name: '改名后' })
  assert.equal(sitesOf('cat-media')[2].name, '改名后')

  const snapshot = removeSite(target.id)
  assert.equal(sitesOf('cat-media').length, 2)
  restoreSite(snapshot.site, snapshot.index)
  assert.equal(sitesOf('cat-media').length, 3)
  assert.equal(sitesOf('cat-media')[2].name, '改名后', '撤销应回到原位置')
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

/* ---------------- 存储异常（B1） ---------------- */

test('写入失败产生提示，恢复后自动清除', async () => {
  await fresh()
  assert.equal(storageWarning.value, '')
  failWrites = true
  addSite({ name: '写不进去', url: 'https://x.example', desc: '', icon: '', categoryId: null })
  await nextTick()
  assert.ok(storageWarning.value)
  failWrites = false
  addSite({ name: '可以写了', url: 'https://y.example', desc: '', icon: '', categoryId: null })
  await nextTick()
  assert.equal(storageWarning.value, '')
})
