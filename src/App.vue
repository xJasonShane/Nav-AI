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
  categoryIndex,
  findCategory,
  removeSite,
  restoreSite,
  moveSitesTo,
  removeSites,
  restoreSites,
  storageNotice,
  clearStorageNotice,
} from './store/data.js'
import { showToast } from './utils/toast.js'
import { draggingId, resetDrag } from './utils/drag.js'
import { flattenCategories } from './utils/grouping.js'
import { useSiteSearch } from './composables/useSiteSearch.js'
import { useNavView } from './composables/useNavView.js'

/* ------- 视图状态 ------- */
const admin = ref(false)
const orderMode = ref(false)
const bulkMode = ref(false)
/** 批量模式下已选中的站点 id */
const selected = ref(new Set())
const bulkTarget = ref('')
const sidebarOpen = ref(false)
const mainRef = ref(null)

/* ------- 弹窗状态 ------- */
const siteModal = ref(null) // { site, categoryId } | null
const showCategoryModal = ref(false)
const showDataModal = ref(false)
const showSettingsModal = ref(false)
const pendingSite = ref(null) // 待确认删除的站点

/* ------- 视图逻辑（搜索 / 分组） ------- */
/** 分类 id → 名称（含 null → 未分类）：供搜索命中分类名与结果卡片标注归属 */
const categoryNames = computed(() => {
  const map = new Map()
  map.set(null, '未分类')
  for (const [id, hit] of categoryIndex.value) map.set(id, hit.node.name)
  return map
})

const search = useSiteSearch(store.sites, categoryNames)
const nav = useNavView()
const { query, searching, results: searchResults, activeIndex, activeDescendant } = search
const { selectedId, groups } = nav

const categoryOptions = computed(() => flattenCategories(store.categories))

/** 跳到主内容（skip link）：聚焦主区而不改变 URL */
function focusMain() {
  mainRef.value?.focus()
}

/** 排序 / 批量两种模式互斥，且进入时清空搜索（搜索结果不参与排序与批量选择） */
function toggleOrder() {
  orderMode.value = !orderMode.value
  if (orderMode.value) {
    bulkMode.value = false
    selected.value = new Set()
    search.reset()
  }
}

function toggleBulk() {
  bulkMode.value = !bulkMode.value
  selected.value = new Set()
  if (bulkMode.value) {
    orderMode.value = false
    search.reset()
  }
}

const selectedTitle = computed(() => {
  if (searching.value) return `搜索结果（${searchResults.value.length}）`
  if (selectedId.value === null) return '全部分类'
  if (selectedId.value === 'uncategorized') return '未分类'
  return nav.selectedCategory.value?.name || ''
})

function selectCategory(id) {
  nav.select(id)
  search.reset()
  // 切分类后从顶部开始：否则从长列表底部切到内容较少的分类会停在空白处
  window.scrollTo(0, 0)
  // 批量模式下切换分类：旧选中项已不可见，必须清空，否则「已选 N 项」与实际不符，
  // 且批量移动/删除会作用到看不见的站点
  if (selected.value.size) selected.value = new Set()
}

/** 排序模式下拖到分组空白处 = 移动到该分类（空分类因此也能接收拖拽） */
function onGroupDragOver(e) {
  if (orderMode.value && draggingId.value) e.preventDefault()
}

function onGroupDrop(e, categoryId) {
  if (!orderMode.value || !draggingId.value) return
  e.preventDefault()
  moveSitesTo([draggingId.value], categoryId === 'uncat' ? null : categoryId)
  resetDrag()
}

/* ------- 批量管理（F6） ------- */

/** 当前视图可见的全部站点（批量选择的范围） */
const visibleSites = computed(() =>
  groups.value.flatMap((g) => [...g.sites, ...g.children.flatMap((c) => c.sites)])
)
const selectedCount = computed(() => selected.value.size)
const allSelected = computed(
  () => visibleSites.value.length > 0 && selectedCount.value === visibleSites.value.length
)

function toggleSelect(id) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleSelectAll() {
  selected.value = allSelected.value ? new Set() : new Set(visibleSites.value.map((s) => s.id))
}

/** 批量移动：目标值 ''=占位、'__none'=未分类、其它为分类 id */
function applyBulkMove() {
  const target = bulkTarget.value
  bulkTarget.value = ''
  const ids = [...selected.value]
  if (!ids.length || !target) return
  const categoryId = target === '__none' ? null : target
  const moved = moveSitesTo(ids, categoryId)
  selected.value = new Set()
  const name = categoryId ? findCategory(categoryId)?.node?.name || '所选分类' : '未分类'
  showToast(`已把 ${moved} 个站点移动到「${name}」`)
}

/** 批量删除：整批可撤销 */
function bulkDelete() {
  const ids = [...selected.value]
  if (!ids.length) return
  const snapshots = removeSites(ids)
  selected.value = new Set()
  if (!snapshots.length) return
  showToast(`已删除 ${snapshots.length} 个站点`, {
    label: '撤销',
    run: () => restoreSites(snapshots),
  })
}

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

/** "/" 聚焦搜索框；↑↓/Enter 在搜索结果间移动与打开；Esc 退出排序/批量 / 清空搜索 */
function onKey(e) {
  if (overlayOpen.value) return
  if (searching.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      search.move(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      search.move(-1)
      return
    }
    if (e.key === 'Enter' && activeIndex.value >= 0) {
      e.preventDefault()
      search.open()
      return
    }
  }
  if (e.key === 'Escape' && (orderMode.value || bulkMode.value)) {
    orderMode.value = false
    bulkMode.value = false
    selected.value = new Set()
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
            :category-name="categoryNames.get(s.categoryId || null) || '未分类'"
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
            <button
              class="btn"
              :class="bulkMode ? 'btn-primary' : 'btn-ghost'"
              type="button"
              :aria-pressed="bulkMode"
              @click="toggleBulk"
            >
              <Icon name="check" :stroke="2.2" />
              {{ bulkMode ? '完成批量' : '批量' }}
            </button>
            <button v-if="!orderMode && !bulkMode" class="btn btn-ghost add-site-btn" type="button" @click="siteModal = { site: null, categoryId: selectedId === 'uncategorized' ? null : selectedId }">
              <Icon name="plus" :stroke="2.2" />
              添加站点
            </button>
          </div>
        </div>

        <!-- 排序模式提示 -->
        <p v-if="orderMode" class="order-hint" role="status">
          拖动卡片调整顺序（拖到其它分组即移动分类），或用卡片上的 ↑↓ 按钮；按 Esc 退出排序。
        </p>

        <!-- 批量操作条 -->
        <div v-if="bulkMode" class="bulk-bar" role="status">
          <span class="bulk-count">已选 <b>{{ selectedCount }}</b> 项</span>
          <button class="btn btn-ghost" type="button" @click="toggleSelectAll">
            {{ allSelected ? '取消全选' : '全选本页' }}
          </button>
          <select
            v-model="bulkTarget"
            class="field-input bulk-select"
            aria-label="批量移动到分类"
            :disabled="!selectedCount"
            @change="applyBulkMove"
          >
            <option value="">移动到分类…</option>
            <option value="__none">未分类</option>
            <option v-for="opt in categoryOptions" :key="opt.id" :value="opt.id">
              {{ (opt.depth ? '　' : '') + opt.name }}
            </option>
          </select>
          <button class="btn btn-danger-solid" type="button" :disabled="!selectedCount" @click="bulkDelete">
            删除选中
          </button>
        </div>

        <template v-if="groups.some((g) => g.sites.length || g.children.some((c) => c.sites.length))">
          <section
            v-for="g in groups"
            :key="g.key"
            class="group"
            @dragover="onGroupDragOver"
            @drop="onGroupDrop($event, g.key)"
          >
            <template v-if="selectedId === null">
              <h2 class="group-title">
                <span class="g-icon">{{ g.icon }}</span>{{ g.title }}
                <span class="badge">{{ g.sites.length + g.children.reduce((n, c) => n + c.sites.length, 0) }}</span>
                <button v-if="admin && !orderMode && !bulkMode" class="g-add" type="button" title="添加站点到该分类" aria-label="添加站点到该分类" @click="siteModal = { site: null, categoryId: g.key }">
                  <Icon name="plus" :stroke="2.2" />
                </button>
              </h2>
            </template>

            <div v-if="g.sites.length || admin" class="grid">
              <SiteCard
                v-for="s in g.sites"
                :key="s.id"
                :site="s"
                :admin="admin"
                :order="orderMode"
                :bulk="bulkMode"
                :selected="selected.has(s.id)"
                @edit="siteModal = { site: s, categoryId: null }"
                @remove="deleteSite(s)"
                @toggle-select="toggleSelect(s.id)"
              />
              <button v-if="admin && !orderMode && !bulkMode && g.key !== 'uncat'" class="add-card btn-dashed" type="button" @click="siteModal = { site: null, categoryId: g.key }">
                <Icon name="plus" :stroke="2.2" />
                添加站点
              </button>
            </div>

            <div
              v-for="child in g.children"
              :key="child.key"
              class="sub-group"
              @dragover="onGroupDragOver"
              @drop="onGroupDrop($event, child.key)"
            >
              <h3 v-if="child.sites.length" class="sub-title">
                <span class="g-icon">{{ child.icon }}</span>{{ child.title }}
                <span class="badge">{{ child.sites.length }}</span>
                <button v-if="admin && !orderMode && !bulkMode" class="g-add" type="button" title="添加站点到该子分类" aria-label="添加站点到该子分类" @click="siteModal = { site: null, categoryId: child.key }">
                  <Icon name="plus" :stroke="2.2" />
                </button>
              </h3>
              <div v-if="child.sites.length" class="grid">
                <SiteCard
                  v-for="s in child.sites"
                  :key="s.id"
                  :site="s"
                  :admin="admin"
                  :order="orderMode"
                  :bulk="bulkMode"
                  :selected="selected.has(s.id)"
                  @edit="siteModal = { site: s, categoryId: null }"
                  @remove="deleteSite(s)"
                  @toggle-select="toggleSelect(s.id)"
                />
              </div>
            </div>
          </section>
        </template>

        <!-- 兜底空状态：任何「没有可渲染分组」的情况都不允许留下纯空白主区 -->
        <EmptyState v-else icon="📭" desc="该分类下还没有站点">
          <button v-if="admin" class="btn btn-primary" type="button" @click="siteModal = { site: null, categoryId: selectedId === 'uncategorized' ? null : selectedId }">添加站点</button>
          <button v-else class="btn btn-ghost" type="button" @click="admin = true">开启管理模式去添加</button>
        </EmptyState>
      </template>
    </main>
  </div>

  <!-- 悬浮添加按钮（管理模式 + 移动端友好） -->
  <button v-if="admin && !searching && !orderMode && !bulkMode" class="fab" type="button" title="添加站点" aria-label="添加站点" @click="siteModal = { site: null, categoryId: null }">
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

/* 模式提示条（排序 / 批量）：吸在顶栏下方，滚动时保持可见 */
.order-hint,
.bulk-bar {
  position: sticky;
  top: var(--topbar-h);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-bottom: var(--sp-4);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
}

.order-hint {
  border: 1px dashed var(--border-strong);
  background: var(--accent-weak);
  color: var(--text-2);
  line-height: var(--lh-relaxed);
}

.bulk-bar {
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}

.bulk-count {
  color: var(--text-2);
  white-space: nowrap;
}

.bulk-select {
  width: auto;
  min-width: 150px;
  height: var(--control-h-sm);
}

.add-site-btn {
  flex-shrink: 0;
}

.group {
  margin-bottom: var(--sp-8);
  /* 长列表优化：离屏分组跳过布局与绘制；auto 让浏览器记住上次渲染高度，避免滚动条跳动 */
  content-visibility: auto;
  contain-intrinsic-size: auto 320px;
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

/* 紧凑密度：更小的卡片与更密的网格（由设置里的卡片密度驱动） */
html[data-density='compact'] .grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--sp-2);
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
