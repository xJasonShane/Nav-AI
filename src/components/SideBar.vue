<script setup>
import { computed } from 'vue'
import { store, sitesOf } from '../store/data.js'

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

function pick(id) {
  emit('select', id)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="drawer-mask" :class="{ show: open }" @click="emit('close')"></div>
  </Teleport>

  <aside class="sidebar" :class="{ open }">
    <nav class="nav">
      <button class="nav-item" :class="{ active: selectedId === null }" @click="pick(null)">
        <span class="nav-icon">🏠</span>
        <span class="nav-name">全部分类</span>
        <span class="nav-count">{{ store.sites.length }}</span>
      </button>

      <template v-for="cat in store.categories" :key="cat.id">
        <button class="nav-item" :class="{ active: selectedId === cat.id }" @click="pick(cat.id)">
          <span class="nav-icon">{{ cat.icon || '📁' }}</span>
          <span class="nav-name">{{ cat.name }}</span>
          <span class="nav-count">{{ countOf(cat) }}</span>
        </button>
        <button
          v-for="child in cat.children"
          :key="child.id"
          class="nav-item sub"
          :class="{ active: selectedId === child.id }"
          @click="pick(child.id)"
        >
          <span class="nav-icon">{{ child.icon || '📂' }}</span>
          <span class="nav-name">{{ child.name }}</span>
          <span class="nav-count">{{ sitesOf(child.id).length }}</span>
        </button>
      </template>

      <button v-if="uncategorizedCount" class="nav-item" :class="{ active: selectedId === 'uncategorized' }" @click="pick('uncategorized')">
        <span class="nav-icon">📥</span>
        <span class="nav-name">未分类</span>
        <span class="nav-count">{{ uncategorizedCount }}</span>
      </button>
    </nav>

    <button class="manage-cats" @click="emit('manage-categories')">
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
  top: 61px;
  height: calc(100vh - 61px);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--bg-soft);
  padding: 14px 10px;
  gap: 12px;
  overflow-y: auto;
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
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 13.5px;
  color: var(--text-2);
  text-align: left;
  transition: background 0.15s, color 0.15s;
  width: 100%;
}

.nav-item:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.nav-item.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-weight: 600;
}

.nav-item.sub {
  padding-left: 28px;
  font-size: 13px;
}

.nav-icon {
  width: 20px;
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

.nav-count {
  font-size: 11.5px;
  color: var(--text-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 7px;
  line-height: 18px;
}

.manage-cats {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  font-size: 13.5px;
  color: var(--text-2);
  border: 1px dashed var(--border);
  transition: border-color 0.15s, color 0.15s;
}

.manage-cats:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.drawer-mask {
  display: none;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 90;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    box-shadow: var(--shadow-hover);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .drawer-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 80;
    background: var(--mask);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  }

  .drawer-mask.show {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
