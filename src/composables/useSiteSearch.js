/**
 * 命令面板式搜索：过滤 + ↑↓ 选择 + Enter 打开。
 * 过滤逻辑在 utils/search.js（纯函数、可单测），这里只负责视图状态与焦点/滚动联动。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { filterSites } from '../utils/search.js'

/** @param {object[]} sites 响应式站点数组（store.sites） */
/** @param {import('vue').ComputedRef<Map<string|null, string>>} [categoryNames] 分类 id → 名称，用于命中分类名 */
export function useSiteSearch(sites, categoryNames) {
  const query = ref('')
  const searching = computed(() => query.value.trim().length > 0)
  const results = computed(() => filterSites(sites, query.value, categoryNames?.value))

  /** 当前选中项下标；-1 表示无选中 */
  const activeIndex = ref(0)

  // 结果集变化后回到首项（含进入/退出搜索）
  watch(results, (list) => {
    activeIndex.value = list.length ? 0 : -1
  })

  /** 供搜索框声明 aria-activedescendant */
  const activeDescendant = computed(() => {
    if (!searching.value || activeIndex.value < 0) return ''
    const site = results.value[activeIndex.value]
    return site ? `search-opt-${site.id}` : ''
  })

  /** 在结果间循环移动，并把选中项滚入视野 */
  function move(delta) {
    const list = results.value
    if (!list.length) return
    activeIndex.value = (activeIndex.value + delta + list.length) % list.length
    const id = list[activeIndex.value]?.id
    nextTick(() => document.getElementById(`search-opt-${id}`)?.scrollIntoView({ block: 'nearest' }))
  }

  /** 在新标签页打开当前选中项 */
  function open() {
    const site = results.value[activeIndex.value]
    if (site) window.open(site.url, '_blank', 'noopener,noreferrer')
  }

  function reset() {
    query.value = ''
  }

  return { query, searching, results, activeIndex, activeDescendant, move, open, reset }
}
