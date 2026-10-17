<script setup>
import { computed, watch, onBeforeUnmount, ref, nextTick } from 'vue'
import { store, sitesOf } from '../store/data.js'
import { lockScroll, unlockScroll } from '../utils/scroll-lock.js'
import { FOCUSABLE, trapTab } from '../utils/focus-trap.js'
import Icon from './Icon.vue'

const props = defineProps({
  selectedId: { type: String, default: null },
  /** 当前标签过滤（空串表示未过滤） */
  activeTag: { type: String, default: '' },
  /** 侧栏展示的高频标签：{ name, count }[] */
  tags: { type: Array, default: () => [] },
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'select-tag', 'manage-categories', 'open-settings', 'close'])

/** 顶级分类站点数（含子分类） */
function countOf(cat) {
  let n = sitesOf(cat.id).length
  for (const child of cat.children || []) n += sitesOf(child.id).length
  return n
}

const uncategorizedCount = computed(() => sitesOf(null).length)

/** 使用统计视图的可用性：有访问记录才显示入口 */
const visitStats = computed(() => {
  let recent = 0
  let frequent = 0
  for (const site of store.sites) {
    if (site.lastVisited > 0) recent += 1
    if (site.visits > 0) frequent += 1
  }
  return { recent, frequent }
})

/** 抽屉根节点：用于初始聚焦与 Tab 焦点陷阱 */
const drawerRef = ref(null)
/** 抽屉打开前的焦点元素，关闭时归还 */
let lastActive = null

/** Esc 关闭 / Tab 在抽屉内循环（避免焦点跑到背后的顶栏与卡片） */
function onKey(e) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key === 'Tab') trapTab(drawerRef.value, e)
}

// 移动端抽屉打开时：焦点移入抽屉 + Tab 陷阱 + 锁定背景滚动
let locked = false
watch(
  () => props.open,
  async (v) => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (v && isMobile) {
      lastActive = document.activeElement
      document.addEventListener('keydown', onKey)
      if (!locked) {
        lockScroll()
        locked = true
      }
      await nextTick()
      drawerRef.value?.querySelector(FOCUSABLE)?.focus?.()
    } else {
      document.removeEventListener('keydown', onKey)
      if (locked) {
        unlockScroll()
        locked = false
      }
      if (lastActive && document.contains(lastActive)) lastActive.focus?.()
      lastActive = null
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (locked) {
    unlockScroll()
    locked = false
  }
  if (lastActive && document.contains(lastActive)) lastActive.focus?.()
})

function pick(id) {
  emit('select', id)
  emit('close')
}

function pickTag(name) {
  emit('select-tag', name)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="drawer-mask" :class="{ show: open }" aria-hidden="true" @click="emit('close')"></div>
  </Teleport>

  <aside ref="drawerRef" class="sidebar" :class="{ open }" aria-label="分类导航" tabindex="-1">
    <div class="drawer-head">
      <span class="drawer-title">分类导航</span>
      <button class="icon-btn" type="button" aria-label="关闭菜单" @click="emit('close')">
        <Icon name="close" :size="16" :stroke="2.2" />
      </button>
    </div>

    <nav class="nav">
      <button class="nav-item" type="button" :class="{ active: selectedId === null }" :aria-current="selectedId === null ? 'true' : undefined" @click="pick(null)">
        <span class="nav-icon">🏠</span>
        <span class="nav-name">全部分类</span>
        <span class="badge">{{ store.sites.length }}</span>
      </button>

      <button v-if="visitStats.recent" class="nav-item" type="button" :class="{ active: selectedId === 'recent' }" :aria-current="selectedId === 'recent' ? 'true' : undefined" @click="pick('recent')">
        <span class="nav-icon">🕘</span>
        <span class="nav-name">最近打开</span>
        <span class="badge">{{ visitStats.recent }}</span>
      </button>
      <button v-if="visitStats.frequent" class="nav-item" type="button" :class="{ active: selectedId === 'frequent' }" :aria-current="selectedId === 'frequent' ? 'true' : undefined" @click="pick('frequent')">
        <span class="nav-icon">🔥</span>
        <span class="nav-name">最常访问</span>
        <span class="badge">{{ visitStats.frequent }}</span>
      </button>

      <template v-for="cat in store.categories" :key="cat.id">
        <button class="nav-item" type="button" :class="{ active: selectedId === cat.id }" :aria-current="selectedId === cat.id ? 'true' : undefined" @click="pick(cat.id)">
          <span class="nav-icon">{{ cat.icon || '📁' }}</span>
          <span class="nav-name">{{ cat.name }}</span>
          <span class="badge">{{ countOf(cat) }}</span>
        </button>
        <button
          v-for="child in cat.children"
          :key="child.id"
          type="button"
          class="nav-item sub"
          :class="{ active: selectedId === child.id }"
          :aria-current="selectedId === child.id ? 'true' : undefined"
          @click="pick(child.id)"
        >
          <span class="nav-icon">{{ child.icon || '📂' }}</span>
          <span class="nav-name">{{ child.name }}</span>
          <span class="badge">{{ sitesOf(child.id).length }}</span>
        </button>
      </template>

      <button v-if="uncategorizedCount" class="nav-item" type="button" :class="{ active: selectedId === 'uncategorized' }" :aria-current="selectedId === 'uncategorized' ? 'true' : undefined" @click="pick('uncategorized')">
        <span class="nav-icon">📥</span>
        <span class="nav-name">未分类</span>
        <span class="badge">{{ uncategorizedCount }}</span>
      </button>

      <template v-if="tags.length">
        <p class="hint nav-label">标签</p>
        <button
          v-for="tag in tags"
          :key="tag.name"
          class="nav-item"
          type="button"
          :class="{ active: activeTag === tag.name }"
          :aria-pressed="activeTag === tag.name"
          @click="pickTag(tag.name)"
        >
          <span class="nav-icon">#</span>
          <span class="nav-name">{{ tag.name }}</span>
          <span class="badge">{{ tag.count }}</span>
        </button>
      </template>

    </nav>

    <div class="side-foot">
      <button class="btn-dashed foot-btn" type="button" @click="emit('manage-categories')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 7h16M4 12h16M4 17h10" />
          <path d="m18 15 2 2 4-4" transform="translate(-4 2)" />
        </svg>
        分类管理
      </button>
      <button class="btn-dashed foot-btn settings-btn" type="button" aria-label="设置" title="设置" @click="emit('open-settings')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  position: sticky;
  top: var(--topbar-h);
  height: calc(100vh - var(--topbar-h));
  height: calc(100dvh - var(--topbar-h));
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--bg-soft);
  padding: var(--sp-3) var(--sp-2) var(--sp-3) calc(var(--sp-2) + env(safe-area-inset-left, 0px));
  gap: var(--sp-3);
  overflow-y: auto;
  /* 抽屉内滚动到边界时不带动背后页面 */
  overscroll-behavior: contain;
}

.drawer-head {
  display: none;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 36px;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  color: var(--text-2);
  text-align: left;
  transition: background var(--dur-1), color var(--dur-1);
  width: 100%;
}

.nav-item:hover {
  background: var(--accent-weak);
  color: var(--text);
}

.nav-item.active {
  background: var(--surface);
  color: var(--accent-text);
  font-weight: var(--fw-semibold);
  box-shadow: var(--shadow-xs);
  position: relative;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  background: var(--accent);
}

.nav-item.active .badge {
  color: var(--accent-text);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.nav-item.sub {
  padding-left: 28px;
}

.nav-label {
  padding: var(--sp-3) var(--sp-3) var(--sp-1);
}

.nav-icon {
  width: 20px;
  font-size: var(--fs-lg);
  text-align: center;
  flex-shrink: 0;
}

.nav-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side-foot {
  display: flex;
  gap: var(--sp-2);
}

.foot-btn {
  flex: 1;
  justify-content: flex-start;
  padding: 0 var(--sp-3);
  min-width: 0;
}

.settings-btn {
  flex: 0 0 auto;
  justify-content: center;
  padding: 0 var(--sp-3);
}

.drawer-mask {
  display: none;
}
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    width: var(--drawer-w);
    height: 100vh;
    height: 100dvh;
    z-index: 90;
    transform: translateX(-100%);
    visibility: hidden;
    transition: transform var(--dur-3) var(--ease-out), visibility 0s linear var(--dur-3);
    box-shadow: none;
    padding-top: calc(var(--sp-3) + env(safe-area-inset-top, 0px));
    padding-bottom: calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
  }

  .sidebar.open {
    transform: translateX(0);
    visibility: visible;
    transition: transform var(--dur-3) var(--ease-out);
    box-shadow: var(--shadow-lg);
  }

  .drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: 0 var(--sp-1) var(--sp-2);
  }

  .drawer-title {
    font-size: var(--fs-lg);
    font-weight: var(--fw-semibold);
  }

  .drawer-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 80;
    background: var(--mask);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-2) var(--ease-out);
    /* 遮罩不接受滚动手势：避免拖拽遮罩时带动背后页面（iOS 上 overflow 锁定不完全可靠） */
    touch-action: none;
  }

  .drawer-mask.show {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
