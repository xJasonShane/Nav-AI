/**
 * 站点搜索（纯函数，便于单测）：按名称 / 描述 / 网址做大小写不敏感的子串匹配。
 * 空查询返回空数组（不返回全部站点），与「未搜索」状态区分开。
 */
export function filterSites(sites, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  return (sites || []).filter((site) =>
    [site.name, site.desc, site.url].some((v) => (v || '').toLowerCase().includes(q))
  )
}
