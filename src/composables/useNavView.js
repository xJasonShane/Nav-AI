/**
 * 主区导航视图：当前选中的分类、分组结构与失效回退。
 * 分组装配逻辑在 utils/grouping.js（纯函数、可单测）。
 */
import { computed, ref, watch } from 'vue'
import { store, sitesOf, findCategory } from '../store/data.js'
import { buildGroups } from '../utils/grouping.js'

/** 上次停留的分类（sessionStorage）：刷新后回到原位置，但不进入数据 schema、不影响导出 */
const LAST_KEY = 'nav-ai-last-category'

function readLastId() {
  try {
    const raw = sessionStorage.getItem(LAST_KEY)
    if (!raw) return null
    if (raw === 'uncategorized') {
      return store.sites.some((site) => !site.categoryId) ? 'uncategorized' : null
    }
    return findCategory(raw) ? raw : null
  } catch (e) {
    return null
  }
}

export function useNavView() {
  /** null = 全部 | 'uncategorized' | 分类 id */
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
    })
  )

  const selectedCategory = computed(() =>
    selectedId.value && selectedId.value !== 'uncategorized'
      ? findCategory(selectedId.value)?.node || null
      : null
  )

  // 分类被删除后，若当前视图仍指向它，回退到「全部」：避免空态误导与向失效分类写入站点
  watch(
    () => store.categories,
    () => {
      const id = selectedId.value
      if (id !== null && id !== 'uncategorized' && !findCategory(id)) selectedId.value = null
    },
    { deep: true }
  )

  function select(id) {
    selectedId.value = id
  }

  return { selectedId, groups, selectedCategory, select }
}
