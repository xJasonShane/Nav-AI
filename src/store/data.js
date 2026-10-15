/**
 * 数据层：分类树 + 站点集合 + localStorage 持久化
 * 结构：
 *   categories: [{ id, name, icon, children: [...] }]   最多两级树
 *   sites:      [{ id, name, url, desc, icon, categoryId }]  categoryId 为 null 表示未分类
 *   settings:   { title, theme }
 */
import { computed, reactive, ref, watch } from 'vue'

const STORAGE_KEY = 'nav-ai-data-v1'
/** 数据损坏时的旁路备份键：避免被默认数据的首次写回覆盖，保留可人工恢复的现场 */
const BACKUP_KEY = `${STORAGE_KEY}.bak`

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
    version: 1,
    settings: { title: 'Nav-AI', theme: 'auto' },
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

/** 把损坏的原始内容另存到旁路键，尽量保住可人工恢复的现场 */
function backupRaw(raw) {
  try { localStorage.setItem(BACKUP_KEY, raw) } catch (e) { /* 空间不足时放弃备份 */ }
}

function load() {
  let raw = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && Array.isArray(data.categories) && Array.isArray(data.sites)) return data
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

// 数据变化时自动持久化（immediate 确保首次加载即写入当前存储键）
watch(
  store,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
      if (storageWarning.value) storageWarning.value = '' // 写入恢复正常后清除提示
    } catch (e) {
      storageWarning.value = '数据保存失败：浏览器存储空间不足或已被禁用，最近的修改可能无法保留，请尽快导出备份。'
    }
  },
  { deep: true, immediate: true }
)

/* ---------------- 分类树操作 ---------------- */

/** 深度遍历所有分类节点 */
export function walkCategories(list = store.categories, fn, parent = null) {
  for (const node of list) {
    fn(node, parent)
    if (node.children?.length) walkCategories(node.children, fn, node)
  }
}

/** 按 id 查找分类节点，返回 { node, parent, list, index } */
export function findCategory(id, list = store.categories, parent = null) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { node: list[i], parent, list, index: i }
    const hit = list[i].children?.length && findCategory(id, list[i].children, list[i])
    if (hit) return hit
  }
  return null
}

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

/** 删除分类：其下所有站点移入"未分类"，子分类一并移除 */
export function removeCategory(id) {
  const hit = findCategory(id)
  if (!hit) return 0
  const ids = new Set([id])
  walkCategories([hit.node], (n) => ids.add(n.id))
  let moved = 0
  store.sites.forEach((s) => {
    if (ids.has(s.categoryId)) {
      s.categoryId = null
      moved++
    }
  })
  hit.list.splice(hit.index, 1)
  return moved
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

export function removeSite(id) {
  const i = store.sites.findIndex((s) => s.id === id)
  if (i !== -1) store.sites.splice(i, 1)
}

/** 某分类下的站点（不含子分类） */
export function sitesOf(categoryId) {
  return store.sites.filter((s) => (s.categoryId || null) === (categoryId || null))
}

/* ---------------- 数据导入 / 导出 ---------------- */

export function exportJSON() {
  return JSON.stringify({ version: 1, ...JSON.parse(JSON.stringify(store)) }, null, 2)
}

export function importJSON(text) {
  const data = JSON.parse(text)
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.sites)) {
    throw new Error('数据格式不正确：缺少 categories 或 sites 字段')
  }
  data.settings = data.settings || { title: 'Nav-AI', theme: 'auto' }
  Object.assign(store, data)
}

export function resetData() {
  Object.assign(store, defaultData())
}

/* ---------------- 主题 ---------------- */

const media = window.matchMedia('(prefers-color-scheme: dark)')

export function applyTheme() {
  const t = store.settings.theme
  const dark = t === 'dark' || (t === 'auto' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

media.addEventListener('change', () => {
  if (store.settings.theme === 'auto') applyTheme()
})

// 主题随数据自动应用：导入备份 / 恢复默认等直接改写 settings.theme 的路径同样生效
watch(() => store.settings.theme, applyTheme)
