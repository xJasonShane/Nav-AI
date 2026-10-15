/**
 * 数据层：分类树 + 站点集合 + localStorage 持久化
 * 结构：
 *   categories: [{ id, name, icon, children: [...] }]   最多两级树
 *   sites:      [{ id, name, url, desc, icon, categoryId }]  categoryId 为 null 表示未分类
 *   settings:   { title, theme, accent, iconSource }
 *   version:    当前 DATA_VERSION；旧数据经 migrate() 升级后再归一化
 */
import { computed, reactive, ref, watch } from 'vue'

const STORAGE_KEY = 'nav-ai-data-v1'
/** 数据损坏时的旁路备份键：避免被默认数据的首次写回覆盖，保留可人工恢复的现场 */
const BACKUP_KEY = `${STORAGE_KEY}.bak`

/** 当前数据版本：新增字段时 +1，并在 MIGRATIONS 中补一条升级函数 */
export const DATA_VERSION = 3

/** 主色预设（与 src/style.css 的 html[data-accent=…] 一一对应） */
export const ACCENT_PRESETS = [
  { key: 'default', label: '经典蓝', color: '#4f7cff' },
  { key: 'ocean', label: '海蓝', color: '#0ea5e9' },
  { key: 'forest', label: '森林绿', color: '#10b981' },
  { key: 'sunset', label: '落日橙', color: '#f59e0b' },
  { key: 'grape', label: '葡萄紫', color: '#8b5cf6' },
  { key: 'rose', label: '玫瑰粉', color: '#ec4899' },
]
const ACCENT_KEYS = ACCENT_PRESETS.map((p) => p.key)
const ICON_SOURCES = ['auto', 'service']
/** 卡片密度预设（与 style.css 的 html[data-density=…] 对应） */
export const DENSITIES = [
  { key: 'comfortable', label: '舒适' },
  { key: 'compact', label: '紧凑' },
]
const DENSITY_KEYS = DENSITIES.map((d) => d.key)

/**
 * 版本迁移链：键为「目标版本」，值为从 上一版 → 该版 的升级函数。
 * 所有读取入口（load / importJSON / applyExternalData）都先走 migrate()，保证下游只处理当前版本结构。
 */
const MIGRATIONS = {
  /** 1 → 2：settings 增加 iconSource（图标源）与 accent（主色预设） */
  2: (data) => ({ ...data, settings: { iconSource: 'auto', accent: 'default', ...(data.settings || {}) } }),
  /** 2 → 3：settings 增加 density（卡片密度）与 showDesc（是否显示描述） */
  3: (data) => ({ ...data, settings: { density: 'comfortable', showDesc: true, ...(data.settings || {}) } }),
}

/** 把任意版本的数据升级到 DATA_VERSION（无法识别的字段由 normalizeData 兜底） */
export function migrate(input) {
  let data = input && typeof input === 'object' ? { ...input } : {}
  let v = Number.isInteger(data.version) ? data.version : 1
  while (v < DATA_VERSION && MIGRATIONS[v + 1]) {
    data = MIGRATIONS[v + 1](data)
    v += 1
  }
  return { ...data, version: DATA_VERSION }
}

/** 读取期异常（数据损坏/存储不可用）：需用户手动关闭 */
const loadWarning = ref('')
/** 写入期异常（配额不足/被禁用）：写入成功后自动清除 */
export const storageWarning = ref('')

/** 合并两类存储异常的可见提示，供界面展示 */
export const storageNotice = computed(() => storageWarning.value || loadWarning.value)

export function clearStorageNotice() {
  storageWarning.value = ''
  loadWarning.value = ''
}

/** 生成短随机 ID */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** 默认演示数据 */
function defaultData() {
  const c = (id) => id
  return {
    version: DATA_VERSION,
    settings: {
      title: 'Nav-AI',
      theme: 'auto',
      accent: 'default',
      iconSource: 'auto',
      density: 'comfortable',
      showDesc: true,
    },
    categories: [
      {
        id: c('cat-daily'), name: '常用推荐', icon: '🌟', children: [],
      },
      {
        id: c('cat-dev'), name: '开发社区', icon: '💻',
        children: [
          { id: c('cat-dev-cn'), name: '国内社区', icon: '', children: [] },
          { id: c('cat-dev-en'), name: '国际社区', icon: '', children: [] },
        ],
      },
      { id: c('cat-doc'), name: '学习文档', icon: '📚', children: [] },
      { id: c('cat-ai'), name: 'AI 工具', icon: '🤖', children: [] },
      { id: c('cat-media'), name: '影音娱乐', icon: '🎬', children: [] },
      { id: c('cat-social'), name: '社交媒体', icon: '💬', children: [] },
    ],
    sites: [
      { id: uid(), name: 'GitHub', url: 'https://github.com', desc: '全球最大代码托管平台', icon: '', categoryId: 'cat-dev-en' },
      { id: uid(), name: 'Stack Overflow', url: 'https://stackoverflow.com', desc: '程序员问答社区', icon: '', categoryId: 'cat-dev-en' },
      { id: uid(), name: '掘金', url: 'https://juejin.cn', desc: '面向开发者的中文技术社区', icon: '', categoryId: 'cat-dev-cn' },
      { id: uid(), name: 'V2EX', url: 'https://v2ex.com', desc: '创意工作者社区', icon: '', categoryId: 'cat-dev-cn' },
      { id: uid(), name: 'MDN Web Docs', url: 'https://developer.mozilla.org', desc: 'Web 技术权威文档', icon: '', categoryId: 'cat-doc' },
      { id: uid(), name: '菜鸟教程', url: 'https://www.runoob.com', desc: '编程入门中文教程', icon: '', categoryId: 'cat-doc' },
      { id: uid(), name: 'ChatGPT', url: 'https://chatgpt.com', desc: 'OpenAI 对话助手', icon: '', categoryId: 'cat-ai' },
      { id: uid(), name: 'Hugging Face', url: 'https://huggingface.co', desc: 'AI 模型与数据集社区', icon: '', categoryId: 'cat-ai' },
      { id: uid(), name: '哔哩哔哩', url: 'https://www.bilibili.com', desc: '高质量视频弹幕网站', icon: '', categoryId: 'cat-media' },
      { id: uid(), name: 'YouTube', url: 'https://www.youtube.com', desc: '全球最大视频平台', icon: '', categoryId: 'cat-media' },
      { id: uid(), name: '微博', url: 'https://weibo.com', desc: '中文社交媒体平台', icon: '', categoryId: 'cat-social' },
      { id: uid(), name: 'X (Twitter)', url: 'https://x.com', desc: '国际社交平台', icon: '', categoryId: 'cat-social' },
      { id: uid(), name: '百度', url: 'https://www.baidu.com', desc: '中文搜索引擎', icon: '', categoryId: 'cat-daily' },
      { id: uid(), name: '知乎', url: 'https://www.zhihu.com', desc: '高质量中文问答社区', icon: '', categoryId: 'cat-daily' },
    ],
  }
}

/**
 * 归一化外部数据（localStorage 回读 / 导入文件）：
 * 补齐字段与默认值、剔除非法节点、保证 id 唯一（缺失或重复时重新生成）、
 * 把指向不存在分类的站点归入「未分类」、分类树截断为最多两级。
 * @returns {{ settings: object, categories: object[], sites: object[], moved: number }} moved = 因分类失效被归入「未分类」的站点数
 */
export function normalizeData(input) {
  const catIds = new Set()
  const siteIds = new Set()

  const cleanCategory = (raw, depth) => {
    if (!raw || typeof raw !== 'object') return null
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    if (!name) return null
    const id = typeof raw.id === 'string' && raw.id && !catIds.has(raw.id) ? raw.id : uid()
    catIds.add(id)
    const node = { id, name, icon: typeof raw.icon === 'string' ? raw.icon : '', children: [] }
    if (depth < 2 && Array.isArray(raw.children)) {
      node.children = raw.children.map((child) => cleanCategory(child, depth + 1)).filter(Boolean)
    }
    return node
  }

  const rawCategories = Array.isArray(input?.categories) ? input.categories : []
  const categories = rawCategories.map((cat) => cleanCategory(cat, 1)).filter(Boolean)

  let moved = 0
  const rawSites = Array.isArray(input?.sites) ? input.sites : []
  const sites = rawSites
    .filter((s) => s && typeof s === 'object' && typeof s.name === 'string' && s.name.trim())
    .map((s) => {
      const id = typeof s.id === 'string' && s.id && !siteIds.has(s.id) ? s.id : uid()
      siteIds.add(id)
      const valid = typeof s.categoryId === 'string' && catIds.has(s.categoryId)
      if (s.categoryId && !valid) moved += 1
      return {
        id,
        name: s.name.trim(),
        url: typeof s.url === 'string' ? s.url : '',
        desc: typeof s.desc === 'string' ? s.desc : '',
        icon: typeof s.icon === 'string' ? s.icon : '',
        categoryId: valid ? s.categoryId : null,
      }
    })

  const rawSettings = input?.settings && typeof input.settings === 'object' ? input.settings : {}
  const settings = {
    title: typeof rawSettings.title === 'string' && rawSettings.title.trim() ? rawSettings.title.trim() : 'Nav-AI',
    theme: ['auto', 'light', 'dark'].includes(rawSettings.theme) ? rawSettings.theme : 'auto',
    accent: ACCENT_KEYS.includes(rawSettings.accent) ? rawSettings.accent : 'default',
    iconSource: ICON_SOURCES.includes(rawSettings.iconSource) ? rawSettings.iconSource : 'auto',
    density: DENSITY_KEYS.includes(rawSettings.density) ? rawSettings.density : 'comfortable',
    // 仅显式 false 才隐藏描述，缺省保持显示
    showDesc: rawSettings.showDesc !== false,
  }

  return { settings, categories, sites, moved }
}

/** 把损坏的原始内容另存到旁路键，尽量保住可人工恢复的现场 */
function backupRaw(raw) {
  try { localStorage.setItem(BACKUP_KEY, raw) } catch (e) { /* 空间不足时放弃备份 */ }
}

function load() {
  let raw = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.sites)) {
        // 先升级版本，再归一化：历史数据里的悬空分类会被归入「未分类」
        const { settings, categories, sites, moved } = normalizeData(migrate(parsed))
        if (moved) loadWarning.value = `检测到 ${moved} 个站点的所属分类已失效，已归入「未分类」。`
        return { version: DATA_VERSION, settings, categories, sites }
      }
      backupRaw(raw)
      loadWarning.value = `本地数据结构异常，已回退为默认示例数据；原内容已备份到 localStorage 的「${BACKUP_KEY}」。`
    }
  } catch (e) {
    if (raw) backupRaw(raw)
    loadWarning.value = raw
      ? '读取本地数据失败，已回退为默认示例数据；原内容已备份，可在浏览器中手动恢复。'
      : '无法读取浏览器本地存储，已使用默认示例数据；本次的修改可能不会被保留。'
  }
  return defaultData()
}

export const store = reactive(load())

let lastPersisted = ''

// 数据变化时自动持久化（immediate 确保首次加载即写入当前存储键）
watch(
  store,
  (val) => {
    const json = JSON.stringify(val)
    // 内容未变（例如刚由其它标签页同步过来）时跳过写回，避免多余的存储事件与写回回环
    if (json === lastPersisted) return
    try {
      localStorage.setItem(STORAGE_KEY, json)
      lastPersisted = json
      if (storageWarning.value) storageWarning.value = '' // 写入恢复正常后清除提示
    } catch (e) {
      storageWarning.value = '数据保存失败：浏览器存储空间不足或已被禁用，最近的修改可能无法保留，请尽快导出备份。'
    }
  },
  { deep: true, immediate: true }
)

/**
 * 多标签页同步：应用其它标签页写入的数据。
 * 内容一致时直接返回 false（既避免无意义的重渲染，也杜绝两个标签页互相写回的回环）。
 */
export function applyExternalData(json) {
  try {
    const parsed = JSON.parse(json)
    const { settings, categories, sites } = normalizeData(migrate(parsed))
    const next = { version: DATA_VERSION, settings, categories, sites }
    if (JSON.stringify(next) === JSON.stringify(store)) return false
    Object.assign(store, next)
    return true
  } catch (e) {
    return false
  }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) applyExternalData(e.newValue)
  })
}

/* ---------------- 分类树操作 ---------------- */

/** 深度遍历所有分类节点 */
export function walkCategories(list = store.categories, fn, parent = null) {
  for (const node of list) {
    fn(node, parent)
    if (node.children?.length) walkCategories(node.children, fn, node)
  }
}

/* ---------------- 派生索引（一次遍历，查询 O(1)） ---------------- */

/** 分类 id → { node, parent, list, index }：供查找、校验与同级排序共用 */
export const categoryIndex = computed(() => {
  const map = new Map()
  const walk = (list, parent) => {
    list.forEach((node, index) => {
      map.set(node.id, { node, parent, list, index })
      if (node.children?.length) walk(node.children, node)
    })
  }
  walk(store.categories, null)
  return map
})

/** 按 id 查找分类节点，返回 { node, parent, list, index }；不存在返回 null */
export function findCategory(id) {
  return (id && categoryIndex.value.get(id)) || null
}

/** 分类 id → 站点列表（键为 null 表示「未分类」），避免按分类逐次全量过滤 */
export const sitesByCategory = computed(() => {
  const map = new Map()
  for (const site of store.sites) {
    const key = site.categoryId || null
    const bucket = map.get(key)
    if (bucket) bucket.push(site)
    else map.set(key, [site])
  }
  return map
})

/** 添加分类（parentId 为 null 时为顶级分类；最多两级） */
export function addCategory(name, icon = '', parentId = null) {
  const node = { id: uid(), name, icon, children: [] }
  if (parentId) {
    const hit = findCategory(parentId)
    if (hit) hit.node.children.push(node)
  } else {
    store.categories.push(node)
  }
  return node
}

export function renameCategory(id, name, icon) {
  const hit = findCategory(id)
  if (hit) {
    hit.node.name = name
    hit.node.icon = icon
  }
}

/** 删除分类：其下所有站点移入"未分类"，子分类一并移除；返回快照供撤销 */
export function removeCategory(id) {
  const hit = findCategory(id)
  if (!hit) return null
  const ids = new Set([id])
  walkCategories([hit.node], (n) => ids.add(n.id))
  const movedSites = []
  store.sites.forEach((site) => {
    if (ids.has(site.categoryId)) {
      movedSites.push({ site, categoryId: site.categoryId })
      site.categoryId = null
    }
  })
  hit.list.splice(hit.index, 1)
  return { node: hit.node, parentId: hit.parent?.id || null, index: hit.index, movedSites }
}

/** 撤销删除分类：放回原位置，并把站点还原到原子分类 */
export function restoreCategory(snapshot) {
  if (!snapshot?.node) return
  if (snapshot.parentId) {
    const parent = findCategory(snapshot.parentId)
    if (!parent) return
    const at = Math.min(snapshot.index, parent.node.children.length)
    parent.node.children.splice(at, 0, snapshot.node)
  } else {
    const at = Math.min(snapshot.index, store.categories.length)
    store.categories.splice(at, 0, snapshot.node)
  }
  for (const { site, categoryId } of snapshot.movedSites || []) site.categoryId = categoryId
}

/** 同级上移 / 下移（dir: -1 上移，1 下移） */
export function moveCategory(id, dir) {
  const hit = findCategory(id)
  if (!hit) return false
  const target = hit.index + dir
  if (target < 0 || target >= hit.list.length) return false
  const [node] = hit.list.splice(hit.index, 1)
  hit.list.splice(target, 0, node)
  return true
}

/* ---------------- 站点操作 ---------------- */

export function addSite({ name, url, desc, icon, categoryId }) {
  store.sites.push({ id: uid(), name, url, desc, icon, categoryId: categoryId || null })
}

export function updateSite(id, patch) {
  const site = store.sites.find((s) => s.id === id)
  if (site) Object.assign(site, patch)
}

/** 删除站点：返回 { site, index } 快照，供「撤销」还原到原位置 */
export function removeSite(id) {
  const index = store.sites.findIndex((s) => s.id === id)
  if (index === -1) return null
  const [site] = store.sites.splice(index, 1)
  return { site, index }
}

/** 撤销删除站点：放回原位置（越界时落到末尾） */
export function restoreSite(site, index) {
  if (!site) return
  const at = Math.min(Math.max(index ?? store.sites.length, 0), store.sites.length)
  store.sites.splice(at, 0, site)
}

/** 批量移动站点到指定分类（categoryId 为 null 表示「未分类」） */
export function moveSitesTo(ids, categoryId) {
  const set = new Set(ids)
  let moved = 0
  for (const site of store.sites) {
    if (!set.has(site.id)) continue
    site.categoryId = categoryId || null
    moved += 1
  }
  return moved
}

/** 批量删除站点：返回按原顺序排列的快照，供撤销 */
export function removeSites(ids) {
  const set = new Set(ids)
  const snapshots = []
  store.sites.forEach((site, index) => {
    if (set.has(site.id)) snapshots.push({ site, index })
  })
  // 从后往前删，避免索引位移
  for (let i = snapshots.length - 1; i >= 0; i -= 1) store.sites.splice(snapshots[i].index, 1)
  return snapshots
}

/** 撤销批量删除：按原索引升序放回 */
export function restoreSites(snapshots) {
  const sorted = [...(snapshots || [])].sort((a, b) => a.index - b.index)
  for (const { site, index } of sorted) {
    const at = Math.min(Math.max(index, 0), store.sites.length)
    store.sites.splice(at, 0, site)
  }
}

/** 同分类内上移 / 下移（dir: -1 上移，1 下移）；跳过其它分类的站点 */
export function moveSite(id, dir) {
  const list = store.sites
  const from = list.findIndex((s) => s.id === id)
  if (from === -1) return false
  const cat = list[from].categoryId || null
  let to = from + dir
  while (to >= 0 && to < list.length && (list[to].categoryId || null) !== cat) to += dir
  if (to < 0 || to >= list.length) return false
  const [node] = list.splice(from, 1)
  // 取出后 to 位置即最终落点（移除元素只会影响其之后的索引，而目标恒在 from 的另一侧）
  list.splice(to, 0, node)
  return true
}

/**
 * 拖拽排序：把 draggedId 插到 targetId 之前 / 之后，并跟随目标分类（拖到别的分组即等于移动分类）。
 * 目标不存在时回滚到原位。
 */
export function moveSiteRelative(draggedId, targetId, after = false) {
  if (draggedId === targetId) return false
  const list = store.sites
  const from = list.findIndex((s) => s.id === draggedId)
  if (from === -1) return false
  const [node] = list.splice(from, 1)
  const targetIndex = list.findIndex((s) => s.id === targetId)
  if (targetIndex === -1) {
    list.splice(from, 0, node)
    return false
  }
  node.categoryId = list[targetIndex].categoryId || null
  list.splice(after ? targetIndex + 1 : targetIndex, 0, node)
  return true
}

/** 某分类下的站点（不含子分类），数据来自派生索引 */
export function sitesOf(categoryId) {
  return sitesByCategory.value.get(categoryId || null) || []
}

/* ---------------- 数据导入 / 导出 ---------------- */

export function exportJSON() {
  return JSON.stringify({ ...JSON.parse(JSON.stringify(store)), version: DATA_VERSION }, null, 2)
}

/**
 * 导入数据：先升级版本、再归一化（补字段 / 去非法节点 / 失效分类归入「未分类」），最后整体替换。
 * @returns {{ categories: number, sites: number, moved: number }} 导入结果，供界面提示
 */
export function importJSON(text) {
  const parsed = JSON.parse(text)
  if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.sites)) {
    throw new Error('数据格式不正确：缺少 categories 或 sites 字段')
  }
  const { settings, categories, sites, moved } = normalizeData(migrate(parsed))
  Object.assign(store, { version: DATA_VERSION, settings, categories, sites })
  return { categories: categories.length, sites: sites.length, moved }
}

/* ---------------- 批量导入（粘贴多行 / 浏览器书签） ---------------- */

/** URL 去重键：忽略协议、www 前缀、末尾斜杠与大小写 */
function urlKey(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
}

/** 按名称查找或创建分类路径（最多两级，更深的层级折叠到第二级） */
function ensureCategoryPath(path) {
  const names = (Array.isArray(path) ? path : []).map((n) => String(n || '').trim()).filter(Boolean).slice(0, 2)
  if (!names.length) return { id: null, created: 0 }
  let created = 0
  let top = store.categories.find((c) => c.name === names[0])
  if (!top) {
    top = addCategory(names[0])
    created += 1
  }
  if (names.length < 2) return { id: top.id, created }
  let child = (top.children || []).find((c) => c.name === names[1])
  if (!child) {
    child = addCategory(names[1], '', top.id)
    created += 1
  }
  return { id: child.id, created }
}

/**
 * 批量导入站点：按 URL 去重（与现有数据比对），返回导入统计。
 * @param {{ name?: string, url: string, categoryPath?: string[] }[]} entries
 * @param {string|null} [fixedCategoryId] 传 null 表示「未分类」；不传则按 categoryPath 建/找分类
 * @returns {{ added: number, skipped: number, categories: number }}
 */
export function importSites(entries, fixedCategoryId) {
  const fixed = fixedCategoryId !== undefined
  const seen = new Set(store.sites.map((s) => urlKey(s.url)).filter(Boolean))
  let added = 0
  let skipped = 0
  let categories = 0
  for (const entry of entries || []) {
    const url = String(entry?.url || '').trim()
    const key = urlKey(url)
    if (!key || seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    let categoryId = null
    if (fixed) {
      categoryId = fixedCategoryId || null
    } else {
      const res = ensureCategoryPath(entry.categoryPath)
      categoryId = res.id
      categories += res.created
    }
    store.sites.push({
      id: uid(),
      name: String(entry.name || '').trim() || key,
      url,
      desc: '',
      icon: '',
      categoryId,
    })
    added += 1
  }
  return { added, skipped, categories }
}

export function resetData() {
  Object.assign(store, defaultData())
}

/* ---------------- 外观（主题 / 主色） ---------------- */

const media =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : { matches: false, addEventListener() {} }

export function applyTheme() {
  const t = store.settings.theme
  const dark = t === 'dark' || (t === 'auto' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

/** 主色预设：写入 data-accent，由 style.css 的 html[data-accent=…] 覆盖 --accent / --accent-2 */
export function applyAccent() {
  document.documentElement.dataset.accent = store.settings.accent || 'default'
}

/** 卡片密度：写入 data-density，由 style.css 的 html[data-density=…] 调整卡片与网格 */
export function applyDensity() {
  document.documentElement.dataset.density = store.settings.density || 'comfortable'
}

/** 站点标题：同步到 <title> 与 PWA 名称（设置面板改名后标签页与主屏名称一起更新） */
export function applyTitle() {
  const title = store.settings.title || 'Nav-AI'
  document.title = title
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', title)
}

/** 首屏一次性应用外观（标题 + 主题 + 主色 + 密度） */
export function applyAppearance() {
  applyTitle()
  applyTheme()
  applyAccent()
  applyDensity()
}

media.addEventListener('change', () => {
  if (store.settings.theme === 'auto') applyTheme()
})

// 标题 / 主题 / 主色 / 密度随数据自动应用：导入备份、恢复默认、设置面板等路径同样生效
watch(() => store.settings.title, applyTitle)
watch(() => store.settings.theme, applyTheme)
watch(() => store.settings.accent, applyAccent)
watch(() => store.settings.density, applyDensity)
