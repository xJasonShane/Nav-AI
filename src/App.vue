<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import TopBar from './components/TopBar.vue'
import SideBar from './components/SideBar.vue'
import SiteCard from './components/SiteCard.vue'
import SiteModal from './components/SiteModal.vue'
import CategoryModal from './components/CategoryModal.vue'
import DataModal from './components/DataModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import Modal from './components/Modal.vue'
import ConfirmCard from './components/ConfirmCard.vue'
import EmptyState from './components/EmptyState.vue'
import Toast from './components/Toast.vue'
import Icon from './components/Icon.vue'
import {
  store,
  sitesOf,
  findCategory,
  removeSite,
  restoreSite,
  storageNotice,
  clearStorageNotice,
} from './store/data.js'
import { showToast } from './utils/toast.js'

/* ------- 视图状态 ------- */
const selectedId = ref(null) // null=全部 | 分类id | 'uncategorized'
const query = ref('')
const admin = ref(false)
const orderMode = ref(false)
const sidebarOpen = ref(false)
const mainRef = ref(null)

/* ------- 弹窗状态 ------- */
const siteModal = ref(null) // { site, categoryId } | null
const showCategoryModal = ref(false)
const showDataModal = ref(false)
const showSettingsModal = ref(false)
const pendingSite = ref(null) // 待确认删除的站点

/** 跳到主内容（skip link）：聚焦主区而不改变 URL */
function focusMain() {
  mainRef.value?.focus()
}

/** 排序模式：进入时清空搜索（搜索结果不参与排序） */
function toggleOrder() {
  orderMode.value = !orderMode.value
  if (orderMode.value) query.value = ''
}

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
    const cat = findCategory(selectedId.value)?.node
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

// 分类被删除后，若当前视图仍指向它，回退到「全部」：避免空态误导与向失效分类写入站点
watch(
  () => store.categories,
  () => {
    const id = selectedId.value
    if (id !== null && id !== 'uncategorized' && !findCategory(id)) selectedId.value = null
  },
  { deep: true }
)

const selectedTitle = computed(() => {
  if (searching.value) return `搜索结果（${searchResults.value.length}）`
  if (selectedId.value === null) return '全部分类'
  if (selectedId.value === 'uncategorized') return '未分类'
  return findCategory(selectedId.value)?.node?.name || ''
})

function selectCategory(id) {
  selectedId.value = id
  query.value = ''
}

/** 搜索结果的当前选中项（命令面板式：↑↓ 选择，Enter 打开） */
const activeIndex = ref(0)

watch(searchResults, (list) => {
  activeIndex.value = list.length ? 0 : -1
})

function moveActive(delta) {
  const list = searchResults.value
  if (!list.length) return
  activeIndex.value = (activeIndex.value + delta + list.length) % list.length
  const id = list[activeIndex.value]?.id
  nextTick(() => document.getElementById(`search-opt-${id}`)?.scrollIntoView({ block: 'nearest' }))
}

function openActive() {
  const site = searchResults.value[activeIndex.value]
  if (site) window.open(site.url, '_blank', 'noopener,noreferrer')
}

/** 供搜索框声明 aria-activedescendant，读屏可跟随当前选中项 */
const activeDescendant = computed(() => {
  if (!searching.value || activeIndex.value < 0) return ''
  const site = searchResults.value[activeIndex.value]
  return site ? `search-opt-${site.id}` : ''
})

/** 删除站点：走统一确认卡（内嵌确认，替换原生 confirm） */
function deleteSite(site) {
  pendingSite.value = site
}

/** 确认删除后提供 6 秒撤销窗口 */
function confirmDeleteSite() {
  const target = pendingSite.value
  pendingSite.value = null
  if (!target) return
  const snapshot = removeSite(target.id)
  if (!snapshot) return
  showToast(`已删除「${target.name}」`, {
    label: '撤销',
    run: () => restoreSite(snapshot.site, snapshot.index),
  })
}

/** 任一浮层（弹窗或移动端抽屉）打开时，全局快捷键让位给浮层 */
const overlayOpen = computed(
  () =>
    sidebarOpen.value ||
    !!siteModal.value ||
    showCategoryModal.value ||
    showDataModal.value ||
    showSettingsModal.value ||
    !!pendingSite.value
)

/** "/" 聚焦搜索框；↑↓/Enter 在搜索结果间移动与打开；Esc 退出排序 / 清空搜索 */
function onKey(e) {
  if (overlayOpen.value) return
  if (searching.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
      return
    }
    if (e.key === 'Enter' && activeIndex.value >= 0) {
      e.preventDefault()
      openActive()
      return
    }
  }
  if (e.key === 'Escape' && orderMode.value) {
    orderMode.value = false
    return
  }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) {
    e.preventDefault()
    document.querySelector('.search input')?.focus()
    return
  }
  if (e.key === 'Escape' && query.value) {
    query.value = ''
  }
}

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

const totalSites = computed(() => store.sites.length)
const isEmpty = computed(() => !searching.value && totalSites.value === 0)
</script>

<template>
  <!-- 键盘用户跳过顶栏直达主内容 -->
  <a class="skip-link" href="#main" @click.prevent="focusMain">跳到主内容</a>

  <!-- 品牌氛围光背景 -->
  <div class="bg-decor" aria-hidden="true">
    <i class="glow g1"></i>
    <i class="glow g2"></i>
  </div>

  <TopBar
    v-model:query="query"
    :admin="admin"
    :searching="searching"
    :active-descendant="activeDescendant"
    @toggle-admin="admin = !admin"
    @open-data="showDataModal = true"
    @toggle-sidebar="sidebarOpen = !sidebarOpen"
  />

  <!-- 存储异常提示（读取失败 / 写入失败），可关闭 -->
  <div v-if="storageNotice" class="notice" role="alert">
    <Icon name="warn" :size="15" />
    <span>{{ storageNotice }}</span>
    <button class="icon-btn-sm notice-close" type="button" aria-label="关闭提示" @click="clearStorageNotice">
      <Icon name="close" />
    </button>
  </div>

  <div class="layout">
    <SideBar
      :selected-id="selectedId"
      :open="sidebarOpen"
      @select="selectCategory"
      @manage-categories="showCategoryModal = true"
      @open-settings="showSettingsModal = true"
      @close="sidebarOpen = false"
    />

    <main ref="mainRef" id="main" class="main" tabindex="-1">
      <!-- 空状态 -->
      <EmptyState
        v-if="isEmpty"
        icon="🧭"
        title="欢迎使用 Nav-AI"
        desc="这是你的专属导航站。点击右下角「＋」或开启「管理」模式添加你的第一个站点吧。"
      >
        <button class="btn btn-primary" type="button" @click="admin = true; siteModal = { site: null, categoryId: null }">添加第一个站点</button>
      </EmptyState>

      <!-- 搜索结果（命令面板式：↑↓ 选择、Enter 打开） -->
      <template v-else-if="searching">
        <h1 class="section-title" aria-live="polite">{{ selectedTitle }}</h1>
        <div v-if="searchResults.length" id="search-results" class="grid" role="listbox" aria-label="搜索结果">
          <SiteCard
            v-for="(s, i) in searchResults"
            :id="`search-opt-${s.id}`"
            :key="s.id"
            role="option"
            :aria-selected="i === activeIndex ? 'true' : 'false'"
            :active="i === activeIndex"
            :site="s"
            :admin="admin"
            @edit="siteModal = { site: s, categoryId: null }"
            @remove="deleteSite(s)"
          />
        </div>
        <EmptyState v-else icon="🔍" :desc="`没有找到与「${query}」匹配的站点`" />
      </template>

      <!-- 分类视图 -->
      <template v-else>
        <div class="view-head">
          <h1 class="section-title">{{ selectedTitle }}</h1>
          <div v-if="admin" class="view-ops">
            <button
              class="btn"
              :class="orderMode ? 'btn-primary' : 'btn-ghost'"
              type="button"
              :aria-pressed="orderMode"
              @click="toggleOrder"
            >
              <Icon name="up" :stroke="2.2" />
              {{ orderMode ? '完成排序' : '排序' }}
            </button>
            <button class="btn btn-ghost add-site-btn" type="button" @click="siteModal = { site: null, categoryId: selectedId === 'uncategorized' ? null : selectedId }">
              <Icon name="plus" :stroke="2.2" />
              添加站点
            </button>
          </div>
        </div>

        <!-- 排序模式提示 -->
        <p v-if="orderMode" class="order-hint" role="status">
          拖动卡片调整顺序（拖到其它分组即移动分类），或用卡片上的 ↑↓ 按钮；按 Esc 退出排序。
        </p>

        <template v-if="groups.some((g) => g.sites.length || g.children.some((c) => c.sites.length))">
          <section v-for="g in groups" :key="g.key" class="group">
            <template v-if="selectedId === null">
              <h2 class="group-title">
                <span class="g-icon">{{ g.icon }}</span>{{ g.title }}
                <span class="badge">{{ g.sites.length + g.children.reduce((n, c) => n + c.sites.length, 0) }}</span>
                <button v-if="admin && !orderMode" class="g-add" type="button" title="添加站点到该分类" aria-label="添加站点到该分类" @click="siteModal = { site: null, categoryId: g.key }">
                  <Icon name="plus" :stroke="2.2" />
                </button>
              </h2>
            </template>

            <div v-if="g.sites.length || admin" class="grid">
              <SiteCard v-for="s in g.sites" :key="s.id" :site="s" :admin="admin" :order="orderMode" @edit="siteModal = { site: s, categoryId: null }" @remove="deleteSite(s)" />
              <button v-if="admin && !orderMode && g.key !== 'uncat'" class="add-card btn-dashed" type="button" @click="siteModal = { site: null, categoryId: g.key }">
                <Icon name="plus" :stroke="2.2" />
                添加站点
              </button>
            </div>

            <div v-for="child in g.children" :key="child.key" class="sub-group">
              <h3 v-if="child.sites.length" class="sub-title">
                <span class="g-icon">{{ child.icon }}</span>{{ child.title }}
                <span class="badge">{{ child.sites.length }}</span>
                <button v-if="admin && !orderMode" class="g-add" type="button" title="添加站点到该子分类" aria-label="添加站点到该子分类" @click="siteModal = { site: null, categoryId: child.key }">
                  <Icon name="plus" :stroke="2.2" />
                </button>
              </h3>
              <div v-if="child.sites.length" class="grid">
                <SiteCard v-for="s in child.sites" :key="s.id" :site="s" :admin="admin" :order="orderMode" @edit="siteModal = { site: s, categoryId: null }" @remove="deleteSite(s)" />
              </div>
            </div>
          </section>
        </template>

        <EmptyState v-else-if="selectedId !== null" icon="📭" desc="该分类下还没有站点">
          <button v-if="admin" class="btn btn-primary" type="button" @click="siteModal = { site: null, categoryId: selectedId === 'uncategorized' ? null : selectedId }">添加站点</button>
          <button v-else class="btn btn-ghost" type="button" @click="admin = true">开启管理模式去添加</button>
        </EmptyState>
      </template>
    </main>
  </div>

  <!-- 悬浮添加按钮（管理模式 + 移动端友好） -->
  <button v-if="admin && !searching && !orderMode" class="fab" type="button" title="添加站点" aria-label="添加站点" @click="siteModal = { site: null, categoryId: null }">
    <Icon name="plus" :size="22" :stroke="2.2" />
  </button>

  <!-- 弹窗 -->
  <SiteModal v-if="siteModal" :site="siteModal.site" :category-id="siteModal.categoryId" @close="siteModal = null" />
  <CategoryModal v-if="showCategoryModal" @close="showCategoryModal = false" />
  <DataModal v-if="showDataModal" @close="showDataModal = false" />
  <SettingsModal v-if="showSettingsModal" @close="showSettingsModal = false" />

  <!-- 删除站点确认（统一确认卡） -->
  <Modal v-if="pendingSite" title="删除站点" :width="400" @close="pendingSite = null">
    <ConfirmCard confirm-text="确认删除" danger @confirm="confirmDeleteSite" @cancel="pendingSite = null">
      确定删除站点「{{ pendingSite.name }}」？删除后 6 秒内可撤销。
    </ConfirmCard>
  </Modal>

  <!-- 全局提示（含删除撤销） -->
  <Toast />
</template>

<style scoped>
/* 品牌氛围光背景 */
.bg-decor {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(110px);
}

.g1 {
  width: 520px;
  height: 420px;
  top: -180px;
  left: 12%;
  background: var(--glow-1);
}

.g2 {
  width: 460px;
  height: 380px;
  top: -140px;
  right: -6%;
  background: var(--glow-2);
}

.layout {
  display: flex;
  min-height: calc(100vh - var(--topbar-h));
  min-height: calc(100dvh - var(--topbar-h));
}

.main {
  flex: 1;
  min-width: 0;
  padding: var(--sp-5) calc(var(--sp-6) + env(safe-area-inset-right, 0px)) 96px
    calc(var(--sp-6) + env(safe-area-inset-left, 0px));
  max-width: 1400px;
}

/* 存储异常提示条：吸在顶栏下方，随内容滚动不丢失 */
.notice {
  position: sticky;
  top: var(--topbar-h);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) calc(var(--sp-5) + env(safe-area-inset-right, 0px)) var(--sp-2)
    calc(var(--sp-5) + env(safe-area-inset-left, 0px));
  background: color-mix(in srgb, var(--danger) 12%, var(--surface));
  border-bottom: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
  color: var(--danger-text);
  font-size: var(--fs-sm);
  line-height: var(--lh-base);
}

.notice span {
  flex: 1;
  min-width: 0;
}

.notice .notice-close:hover {
  background: color-mix(in srgb, var(--danger) 16%, transparent);
  color: var(--danger-text);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  font-size: var(--fs-xl);
  font-weight: var(--fw-bold);
  line-height: var(--lh-tight);
  margin-bottom: var(--sp-4);
}

.section-title::before {
  content: '';
  width: 4px;
  height: 20px;
  border-radius: var(--radius-pill);
  background: var(--gradient);
  flex-shrink: 0;
}

.view-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.view-ops {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
}

/* 排序模式提示条 */
.order-hint {
  margin-bottom: var(--sp-4);
  padding: var(--sp-2) var(--sp-3);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--accent-weak);
  color: var(--text-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-relaxed);
}

.add-site-btn {
  flex-shrink: 0;
}

.group {
  margin-bottom: var(--sp-8);
}

.group-title,
.sub-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: var(--fw-semibold);
  line-height: var(--lh-tight);
  margin: 0 0 var(--sp-3);
  color: var(--text);
}

.group-title {
  font-size: var(--fs-lg);
}

.sub-title {
  font-size: var(--fs-md);
}

.g-icon {
  font-size: var(--fs-lg);
  line-height: 1;
}

.g-add {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-btn-sm);
  height: var(--icon-btn-sm);
  border-radius: var(--radius-xs);
  color: var(--text-2);
  transition: opacity var(--dur-1), color var(--dur-1), background var(--dur-1);
}

.g-add::after {
  content: '';
  position: absolute;
  inset: -6px;
}

.g-add:hover {
  color: var(--accent);
  background: var(--accent-weak);
}

/* 桌面端悬停/聚焦显现；触摸设备常显 */
@media (hover: hover) {
  .g-add {
    opacity: 0;
  }

  .group:hover .g-add,
  .sub-title:hover .g-add,
  .g-add:focus-visible {
    opacity: 1;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: var(--sp-3);
}

.sub-group {
  margin-top: var(--sp-4);
}

.add-card {
  min-height: 70px;
  font-size: var(--fs-sm);
  color: var(--text-2);
}

/* 跳到主内容：默认移出视口，仅在键盘聚焦时出现 */
.skip-link {
  position: fixed;
  top: var(--sp-2);
  left: var(--sp-2);
  z-index: 120;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-md);
  color: var(--accent);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  transform: translateY(calc(-100% - var(--sp-4)));
  transition: transform var(--dur-2) var(--ease-out);
}

.skip-link:focus-visible {
  transform: translateY(0);
}

.fab {
  position: fixed;
  right: calc(var(--sp-6) + env(safe-area-inset-right, 0px));
  bottom: calc(var(--sp-6) + env(safe-area-inset-bottom, 0px));
  z-index: 60;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--gradient);
  color: var(--on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 28px -6px color-mix(in srgb, var(--accent) 55%, transparent);
  transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2);
}

.fab::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
  animation: fab-pulse 2.4s var(--ease-out) 3;
}

@keyframes fab-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.9;
  }
  70%,
  100% {
    transform: scale(1.18);
    opacity: 0;
  }
}

.fab:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 14px 34px -6px color-mix(in srgb, var(--accent) 62%, transparent);
}

@media (max-width: 768px) {
  .main {
    padding: var(--sp-4) calc(var(--sp-4) + env(safe-area-inset-right, 0px)) 88px
      calc(var(--sp-4) + env(safe-area-inset-left, 0px));
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--sp-2);
  }

  .fab {
    right: calc(var(--sp-4) + env(safe-area-inset-right, 0px));
    bottom: calc(var(--sp-4) + env(safe-area-inset-bottom, 0px));
  }
}
</style>
