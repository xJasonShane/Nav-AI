/**
 * 主区分组装配（纯函数，便于单测）：
 * 把分类树与站点装配成模板直接消费的结构
 *   [{ key, title, icon, sites, children: [{ key, title, icon, sites }] }]
 *
 * @param {object} opts
 * @param {object[]} opts.categories 分类树
 * @param {(categoryId: string|null) => object[]} opts.sitesOf 按分类取站点（不含子分类）
 * @param {string|null} opts.selectedId null = 全部 | 'uncategorized' | 'recent' | 'frequent' | 分类 id
 * @param {(id: string) => object|null} [opts.findNode] 按 id 取分类节点
 * @param {object[]} [opts.allSites] 全量站点（recent / frequent 虚拟视图使用）
 * @param {boolean} [opts.pinnedFirst] 分组内是否把置顶站点排到最前（排序模式应传 false）
 */
export function buildGroups({ categories, sitesOf, selectedId, findNode, allSites, pinnedFirst = false }) {
  /** 稳定分区：置顶在前，其余保持原有相对顺序；不修改 store 数组 */
  const order = (list) => {
    if (!pinnedFirst) return list
    const pinned = []
    const rest = []
    for (const site of list) (site.pinned ? pinned : rest).push(site)
    return [...pinned, ...rest]
  }

  if (selectedId === 'uncategorized') {
    return [{ key: 'uncat', title: '未分类', icon: '📥', sites: order(sitesOf(null)), children: [] }]
  }

  if (selectedId === 'recent') {
    const list = (allSites || [])
      .filter((site) => site.lastVisited > 0)
      .sort((a, b) => b.lastVisited - a.lastVisited)
    return [{ key: 'recent', title: '最近打开', icon: '🕘', sites: list.slice(0, 60), children: [] }]
  }

  if (selectedId === 'frequent') {
    const list = (allSites || [])
      .filter((site) => site.visits > 0)
      .sort((a, b) => b.visits - a.visits || b.lastVisited - a.lastVisited)
    return [{ key: 'frequent', title: '最常访问', icon: '🔥', sites: list.slice(0, 60), children: [] }]
  }

  const toGroup = (cat) => ({
    key: cat.id,
    title: cat.name,
    icon: cat.icon || '📁',
    sites: order(sitesOf(cat.id)),
    children: (cat.children || []).map((child) => ({
      key: child.id,
      title: child.name,
      icon: child.icon || '📂',
      sites: order(sitesOf(child.id)),
    })),
  })

  if (selectedId) {
    const node = (findNode && findNode(selectedId)) || (categories || []).find((c) => c.id === selectedId)
    return node ? [toGroup(node)] : []
  }

  const groups = (categories || []).map(toGroup)
  // 「全部分类」视图必须同样展示未分类站点：否则删除分类后站点会从浏览视图消失
  // （搜索仍能命中，但用户会误以为数据丢失）
  const uncategorized = order(sitesOf(null))
  if (uncategorized.length) {
    groups.push({ key: 'uncat', title: '未分类', icon: '📥', sites: uncategorized, children: [] })
  }
  return groups
}

/**
 * 分类扁平化（供下拉选择使用）：顶级 + 子分类，附带 depth 便于缩进展示。
 * @returns {{ id: string, name: string, icon: string, depth: number }[]}
 */
export function flattenCategories(categories) {
  const list = []
  for (const cat of categories || []) {
    list.push({ id: cat.id, name: cat.name, icon: cat.icon || '', depth: 0 })
    for (const child of cat.children || []) {
      list.push({ id: child.id, name: child.name, icon: child.icon || '', depth: 1 })
    }
  }
  return list
}
