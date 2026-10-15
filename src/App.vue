<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import TopBar from './components/TopBar.vue'
import SideBar from './components/SideBar.vue'
import SiteCard from './components/SiteCard.vue'
import SiteModal from './components/SiteModal.vue'
import CategoryModal from './components/CategoryModal.vue'
import DataModal from './components/DataModal.vue'
import { store, sitesOf, removeSite } from './store/data.js'

/* ------- 视图状态 ------- */
const selectedId = ref(null) // null=全部 | 分类id | 'uncategorized'
const query = ref('')
const admin = ref(false)
const sidebarOpen = ref(false)

/* ------- 弹窗状态 ------- */
const siteModal = ref(null) // { site, categoryId } | null
const showCategoryModal = ref(false)
const showDataModal = ref(false)

const searching = computed(() => query.value.trim().length > 0)

/** 搜索结果 */
const searchResults = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return store.sites.filter((s) =>
    [s.name, s.desc, s.url].some((v) => (v || '').toLowerCase().includes(q))
  )
})

/** 主区分组：[{ key, title, icon, sites, children: [{ key, title, icon, sites }] }] */
const groups = computed(() => {
  if (searching.value) return []
  if (selectedId.value === 'uncategorized') {
    return [{ key: 'uncat', title: '未分类', icon: '📥', sites: sitesOf(null), children: [] }]
  }
  if (selectedId.value) {
    const cat = findCat(selectedId.value)
    if (!cat) return []
    return [
      {
        key: cat.id,
        title: cat.name,
        icon: cat.icon || '📁',
        sites: sitesOf(cat.id),
        children: (cat.children || []).map((c) => ({
          key: c.id, title: c.name, icon: c.icon || '📂', sites: sitesOf(c.id),
        })),
      },
    ]
  }
  // 全部视图
  return store.categories.map((cat) => ({
    key: cat.id,
    title: cat.name,
    icon: cat.icon || '📁',
    sites: sitesOf(cat.id),
    children: (cat.children || []).map((c) => ({
      key: c.id, title: c.name, icon: c.icon || '📂', sites: sitesOf(c.id),
    })),
  }))
})

function findCat(id, list = store.categories) {
  for (const n of list) {
    if (n.id === id) return n
    const hit = n.children?.length && findCat(id, n.children)
    if (hit) return hit
  }
  return null
}

const selectedTitle = computed(() => {
  if (searching.value) return `搜索结果（${searchResults.value.length}）`
  if (selectedId.value === null) return '全部分类'
  if (selectedId.value === 'uncategorized') return '未分类'
  return findCat(selectedId.value)?.name || ''
})

function selectCategory(id) {
  selectedId.value = id
  query.value = ''
}

/** 删除站点（带确认） */
function deleteSite(site) {
  if (confirm(`确定删除站点「${site.name}」？`)) removeSite(site.id)
}

/** "/" 快捷键聚焦搜索框 */
function onKey(e) {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) {
    e.preventDefault()
    document.querySelector('.search input')?.focus()
  }
}

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

const totalSites = computed(() => store.sites.length)
const isEmpty = computed(() => !searching.value && totalSites.value === 0)
</script>

<template>
  <TopBar
    v-model:query="query"
    :admin="admin"
    @toggle-admin="admin = !admin"
    @open-data="showDataModal = true"
    @toggle-sidebar="sidebarOpen = !sidebarOpen"
  />

  <div class="layout">
    <SideBar
      :selected-id="selectedId"
      :open="sidebarOpen"
      @select="selectCategory"
      @manage-categories="showCategoryModal = true"
      @close="sidebarOpen = false"
    />

    <main class="main">
      <!-- 空状态 -->
      <div v-if="isEmpty" class="empty-state">
        <div class="empty-logo">🧭</div>
        <h2>欢迎使用 Nav-AI</h2>
        <p>这是你的专属导航站。点击右下角「＋」或开启「管理」模式添加你的第一个站点吧。</p>
        <button class="btn btn-primary" @click="admin = true; siteModal = { site: null, categoryId: null }">添加第一个站点</button>
      </div>

      <!-- 搜索结果 -->
      <template v-else-if="searching">
        <h1 class="section-title">{{ selectedTitle }}</h1>
        <div v-if="searchResults.length" class="grid">
          <SiteCard v-for="s in searchResults" :key="s.id" :site="s" :admin="admin" @edit="siteModal = { site: s, categoryId: null }" @remove="deleteSite(s)" />
        </div>
        <p v-else class="no-result">没有找到与「{{ query }}」匹配的站点</p>
      </template>

      <!-- 分类视图 -->
      <template v-else>
        <div class="view-head">
          <h1 class="section-title">{{ selectedTitle }}</h1>
          <button v-if="admin" class="btn btn-ghost add-site-btn" @click="siteModal = { site: null, categoryId: selectedId === 'uncategorized' ? null : selectedId }">
            ＋ 添加站点
          </button>
        </div>

        <template v-if="groups.some((g) => g.sites.length || g.children.some((c) => c.sites.length))">
          <section v-for="g in groups" :key="g.key" class="group">
            <template v-if="selectedId === null">
              <h2 class="group-title">
                <span class="g-icon">{{ g.icon }}</span>{{ g.title }}
                <span class="g-count">{{ g.sites.length + g.children.reduce((n, c) => n + c.sites.length, 0) }}</span>
                <button v-if="admin" class="g-add" title="添加站点到该分类" @click="siteModal = { site: null, categoryId: g.key }">＋</button>
              </h2>
            </template>

            <div v-if="g.sites.length || admin" class="grid">
              <SiteCard v-for="s in g.sites" :key="s.id" :site="s" :admin="admin" @edit="siteModal = { site: s, categoryId: null }" @remove="deleteSite(s)" />
              <button v-if="admin && g.key !== 'uncat'" class="add-card" @click="siteModal = { site: null, categoryId: g.key }">＋ 添加站点</button>
            </div>

            <div v-for="child in g.children" :key="child.key" class="sub-group">
              <h3 v-if="child.sites.length" class="sub-title">
                <span class="g-icon">{{ child.icon }}</span>{{ child.title }}
                <span class="g-count">{{ child.sites.length }}</span>
                <button v-if="admin" class="g-add" title="添加站点到该子分类" @click="siteModal = { site: null, categoryId: child.key }">＋</button>
              </h3>
              <div v-if="child.sites.length" class="grid">
                <SiteCard v-for="s in child.sites" :key="s.id" :site="s" :admin="admin" @edit="siteModal = { site: s, categoryId: null }" @remove="deleteSite(s)" />
              </div>
            </div>
          </section>
        </template>

        <div v-else-if="selectedId !== null" class="empty-state small">
          <div class="empty-logo">📭</div>
          <p>该分类下还没有站点</p>
          <button v-if="admin" class="btn btn-primary" @click="siteModal = { site: null, categoryId: selectedId === 'uncategorized' ? null : selectedId }">添加站点</button>
          <button v-else class="btn btn-ghost" @click="admin = true">开启管理模式去添加</button>
        </div>
      </template>
    </main>
  </div>

  <!-- 悬浮添加按钮（管理模式 + 移动端友好） -->
  <button v-if="admin && !searching" class="fab" title="添加站点" @click="siteModal = { site: null, categoryId: null }">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </button>

  <!-- 弹窗 -->
  <SiteModal v-if="siteModal" :site="siteModal.site" :category-id="siteModal.categoryId" @close="siteModal = null" />
  <CategoryModal v-if="showCategoryModal" @close="showCategoryModal = false" />
  <DataModal v-if="showDataModal" @close="showDataModal = false" />
</template>

<style scoped>
.layout {
  display: flex;
  min-height: calc(100vh - 61px);
}

.main {
  flex: 1;
  min-width: 0;
  padding: 22px 26px 60px;
  max-width: 1400px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 18px;
}

.view-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.add-site-btn {
  flex-shrink: 0;
}

.group {
  margin-bottom: 30px;
}

.group-title,
.sub-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--text);
}

.group-title {
  font-size: 16px;
}

.g-icon {
  font-size: 17px;
}

.g-count {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--text-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 8px;
  line-height: 18px;
}

.g-add {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.group:hover .g-add,
.sub-title:hover .g-add {
  opacity: 1;
}

.g-add:hover {
  color: var(--accent);
  background: var(--surface-hover);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

.sub-group {
  margin-top: 18px;
}

.add-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 68px;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  font-size: 13.5px;
  transition: border-color 0.15s, color 0.15s;
}

.add-card:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.empty-state {
  text-align: center;
  padding: 90px 20px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-state.small {
  padding: 60px 20px;
}

.empty-logo {
  font-size: 52px;
}

.empty-state h2 {
  font-size: 20px;
}

.empty-state p {
  color: var(--text-3);
  font-size: 14px;
  max-width: 380px;
}

.no-result {
  text-align: center;
  color: var(--text-3);
  padding: 60px 0;
  font-size: 14px;
}

.fab {
  position: fixed;
  right: 26px;
  bottom: 26px;
  z-index: 60;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--gradient);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgb(79 124 255 / 0.45);
  transition: transform 0.15s, box-shadow 0.15s;
}

.fab:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 12px 30px rgb(79 124 255 / 0.55);
}

@media (max-width: 768px) {
  .main {
    padding: 16px 14px 70px;
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }

  .fab {
    right: 18px;
    bottom: 18px;
  }
}
</style>
