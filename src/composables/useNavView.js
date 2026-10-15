/**
 * 主区导航视图：当前选中的分类、分组结构与失效回退。
 * 分组装配逻辑在 utils/grouping.js（纯函数、可单测）。
 */
import { computed, ref, watch } from 'vue'
import { store, sitesOf, findCategory } from '../store/data.js'
import { buildGroups } from '../utils/grouping.js'

export function useNavView() {
  /** null = 全部 | 'uncategorized' | 分类 id */
  const selectedId = ref(null)

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
