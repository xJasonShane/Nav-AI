/**
 * 主区分组装配（纯函数，便于单测）：
 * 把分类树与站点装配成模板直接消费的结构
 *   [{ key, title, icon, sites, children: [{ key, title, icon, sites }] }]
 *
 * @param {object} opts
 * @param {object[]} opts.categories 分类树
 * @param {(categoryId: string|null) => object[]} opts.sitesOf 按分类取站点（不含子分类）
 * @param {string|null} opts.selectedId null = 全部 | 'uncategorized' | 分类 id
 * @param {(id: string) => object|null} [opts.findNode] 按 id 取分类节点
 */
export function buildGroups({ categories, sitesOf, selectedId, findNode }) {
  if (selectedId === 'uncategorized') {
    return [{ key: 'uncat', title: '未分类', icon: '📥', sites: sitesOf(null), children: [] }]
  }

  const toGroup = (cat) => ({
    key: cat.id,
    title: cat.name,
    icon: cat.icon || '📁',
    sites: sitesOf(cat.id),
    children: (cat.children || []).map((child) => ({
      key: child.id,
      title: child.name,
      icon: child.icon || '📂',
      sites: sitesOf(child.id),
    })),
  })

  if (selectedId) {
    const node = (findNode && findNode(selectedId)) || (categories || []).find((c) => c.id === selectedId)
    return node ? [toGroup(node)] : []
  }

  return (categories || []).map(toGroup)
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
