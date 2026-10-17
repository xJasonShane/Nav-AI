/**
 * 主区导航视图：当前选中的分类、分组结构与失效回退。
 * 分组装配逻辑在 utils/grouping.js（纯函数、可单测）。
 */
import { computed, ref, watch } from 'vue'
import { store, sitesOf, findCategory } from '../store/data.js'
import { buildGroups } from '../utils/grouping.js'

/** 上次停留的分类（sessionStorage）：刷新后回到原位置，但不进入数据 schema、不影响导出 */
const LAST_KEY = 'nav-ai-last-category'

/** 非分类的虚拟视图：不参与「分类被删除」的失效回退 */
const VIRTUAL_VIEWS = new Set(['uncategorized', 'recent', 'frequent'])

function readLastId() {
  try {
    const raw = sessionStorage.getItem(LAST_KEY)
    if (!raw) return null
    if (raw === 'uncategorized') {
      return store.sites.some((site) => !site.categoryId) ? raw : null
    }
    if (raw === 'recent') {
      return store.sites.some((site) => site.lastVisited > 0) ? raw : null
    }
    if (raw === 'frequent') {
      return store.sites.some((site) => site.visits > 0) ? raw : null
    }
    return findCategory(raw) ? raw : null
  } catch (e) {
    return null
  }
}

/**
 * @param {{ pinnedFirst?: () => boolean }} [options]
 *   pinnedFirst：分组内是否置顶优先（排序模式应返回 false，使 ↑↓ 与显示顺序一致）
 */
export function useNavView({ pinnedFirst } = {}) {
  /** null = 全部 | 'uncategorized' | 'recent' | 'frequent' | 分类 id */
  const selectedId = ref(readLastId())

  watch(selectedId, (id) => {
    try {
      sessionStorage.setItem(LAST_KEY, id || '')
    } catch (e) {
      /* 隐私模式 / 禁用存储时忽略：仅影响「记住上次分类」，不影响主流程 */
    }
  })

  const groups = computed(() =>
    buildGroups({
      categories: store.categories,
      sitesOf,
      selectedId: selectedId.value,
      findNode: (id) => findCategory(id)?.node || null,
      allSites: store.sites,
      pinnedFirst: pinnedFirst ? pinnedFirst() : true,
    })
  )

  const selectedCategory = computed(() =>
    selectedId.value && !VIRTUAL_VIEWS.has(selectedId.value)
      ? findCategory(selectedId.value)?.node || null
      : null
  )

  // 分类被删除后，若当前视图仍指向它，回退到「全部」：避免空态误导与向失效分类写入站点
  watch(
    () => store.categories,
    () => {
      const id = selectedId.value
      if (id !== null && !VIRTUAL_VIEWS.has(id) && !findCategory(id)) selectedId.value = null
    },
    { deep: true }
  )

  function select(id) {
    selectedId.value = id
  }

  return { selectedId, groups, selectedCategory, select }
}
