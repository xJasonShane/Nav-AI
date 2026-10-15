<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import { store, sitesOf } from '../store/data.js'
import { lockScroll, unlockScroll } from '../utils/scroll-lock.js'
import Icon from './Icon.vue'

const props = defineProps({
  selectedId: { type: String, default: null },
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'manage-categories', 'close'])

/** 顶级分类站点数（含子分类） */
function countOf(cat) {
  let n = sitesOf(cat.id).length
  for (const child of cat.children || []) n += sitesOf(child.id).length
  return n
}

const uncategorizedCount = computed(() => sitesOf(null).length)

/** Esc 关闭抽屉 */
function onEsc(e) {
  if (e.key === 'Escape') emit('close')
}

// 移动端抽屉打开时：支持 Esc 关闭 + 锁定背景滚动
let locked = false
watch(
  () => props.open,
  (v) => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (v && isMobile) {
      document.addEventListener('keydown', onEsc)
      if (!locked) {
        lockScroll()
        locked = true
      }
    } else {
      document.removeEventListener('keydown', onEsc)
      if (locked) {
        unlockScroll()
        locked = false
      }
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEsc)
  if (locked) {
    unlockScroll()
    locked = false
  }
})

function pick(id) {
  emit('select', id)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="drawer-mask" :class="{ show: open }" aria-hidden="true" @click="emit('close')"></div>
  </Teleport>

  <aside class="sidebar" :class="{ open }" aria-label="分类导航">
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
    </nav>

    <button class="btn-dashed manage-cats" type="button" @click="emit('manage-categories')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16M4 12h16M4 17h10" />
        <path d="m18 15 2 2 4-4" transform="translate(-4 2)" />
      </svg>
      分类管理
    </button>
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
  color: var(--accent);
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
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.nav-item.sub {
  padding-left: 28px;
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

.manage-cats {
  width: 100%;
  justify-content: flex-start;
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
