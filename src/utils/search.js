/**
 * 站点搜索（纯函数，便于单测）：
 * 按名称 / 所属分类 / 标签 / 描述 / 网址做大小写不敏感匹配，并按相关性排序：
 *   名称前缀(100) > 名称包含(80) > 分类名包含(60) > 标签命中(50) > 描述包含(40) > 网址包含(20)
 * 同分保持数据原顺序，避免输入过程中结果跳动。
 * 空查询返回空数组（不返回全部站点），与「未搜索」状态区分开。
 *
 * @param {object[]} sites
 * @param {string} query
 * @param {Map<string|null, string>} [categoryNames] 分类 id → 名称（null 表示未分类）
 */

/** 单条站点的相关性得分；0 表示不命中 */
function scoreOf(site, query, categoryNames) {
  const name = (site.name || '').toLowerCase()
  if (name.startsWith(query)) return 100
  if (name.includes(query)) return 80

  const category = categoryNames ? categoryNames.get(site.categoryId || null) : ''
  if (category && category.toLowerCase().includes(query)) return 60

  if ((site.tags || []).some((tag) => String(tag).toLowerCase().includes(query))) return 50

  if ((site.desc || '').toLowerCase().includes(query)) return 40
  if ((site.url || '').toLowerCase().includes(query)) return 20
  return 0
}

export function filterSites(sites, query, categoryNames) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []

  const scored = []
  ;(sites || []).forEach((site, index) => {
    const score = scoreOf(site, q, categoryNames)
    if (score > 0) scored.push({ site, index, score })
  })

  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.map((item) => item.site)
}
