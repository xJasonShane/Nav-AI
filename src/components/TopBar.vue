<script setup>
import { computed } from 'vue'
import { store, applyTheme } from '../store/data.js'

const props = defineProps({
  query: { type: String, default: '' },
  admin: { type: Boolean, default: false },
  /** 正在搜索（搜索结果列表已展开） */
  searching: { type: Boolean, default: false },
  /** 当前选中的搜索结果元素 id，配合搜索结果 listbox 使用 */
  activeDescendant: { type: String, default: '' },
})

const emit = defineEmits(['update:query', 'open-data', 'toggle-admin', 'toggle-sidebar'])

const themeIcon = computed(() => {
  const t = store.settings.theme
  if (t === 'light') return 'sun'
  if (t === 'dark') return 'moon'
  return 'auto'
})

function cycleTheme() {
  const order = ['auto', 'light', 'dark']
  const next = order[(order.indexOf(store.settings.theme) + 1) % order.length]
  store.settings.theme = next
  applyTheme()
}

const themeLabel = { auto: '跟随系统', light: '浅色模式', dark: '深色模式' }
</script>

<template>
  <header class="topbar">
    <button class="icon-btn menu-btn" type="button" aria-label="打开分类菜单" @click="emit('toggle-sidebar')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    </button>

    <div class="brand">
      <span class="logo" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
          <g transform="rotate(45 32 32)">
            <path d="M32 14 L37.4 32 L32 50 L26.6 32 Z" fill="#fff" />
            <path d="M32 50 L26.6 32 L32 32 Z" fill="rgba(16,32,88,.28)" />
          </g>
          <circle cx="32" cy="32" r="3.2" fill="#fff" />
        </svg>
      </span>
      <span class="brand-name">{{ store.settings.title }}</span>
    </div>

    <div class="search" role="search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        role="combobox"
        :value="query"
        placeholder="搜索站点名称、描述或网址…"
        aria-label="搜索站点，按 / 键快速聚焦，↑↓ 选择，Enter 打开"
        :aria-expanded="searching ? 'true' : 'false'"
        :aria-controls="searching ? 'search-results' : undefined"
        :aria-activedescendant="activeDescendant || undefined"
        @input="emit('update:query', $event.target.value)"
      />
      <kbd v-if="!query" aria-hidden="true">/</kbd>
    </div>

    <div class="actions">
      <button class="icon-btn" type="button" :title="themeLabel[store.settings.theme]" :aria-label="'切换主题（当前：' + themeLabel[store.settings.theme] + '）'" @click="cycleTheme">
        <svg v-if="themeIcon === 'auto'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
        </svg>
        <svg v-else-if="themeIcon === 'sun'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
        <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </button>

      <button class="icon-btn" type="button" title="数据管理（导入 / 导出）" aria-label="数据管理" @click="emit('open-data')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      </button>

      <button class="btn admin-toggle" type="button" :class="admin ? 'btn-primary' : 'btn-ghost'" :aria-pressed="admin" @click="emit('toggle-admin')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        {{ admin ? '完成管理' : '管理' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) calc(var(--sp-5) + env(safe-area-inset-right, 0px)) var(--sp-3)
    calc(var(--sp-5) + env(safe-area-inset-left, 0px));
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.icon-btn {
  width: var(--control-h);
  height: var(--control-h);
}

.menu-btn {
  display: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
  min-width: 0;
}

.logo {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: var(--gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-accent-sm);
  flex-shrink: 0;
}

.brand-name {
  font-size: var(--fs-lg);
  font-weight: var(--fw-bold);
  letter-spacing: 0.2px;
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 30vw;
}

.search {
  flex: 1;
  max-width: 460px;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0 var(--sp-3);
  height: var(--control-h);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-3);
  transition: border-color var(--dur-1), box-shadow var(--dur-1);
  margin: 0 auto;
}

.search svg {
  flex-shrink: 0;
}

.search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.search input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--fs-sm);
  color: var(--text);
  min-width: 0;
}

.search input:focus-visible {
  outline: none;
}

.search kbd {
  font-size: var(--fs-xs);
  line-height: 1;
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: var(--bg-soft);
  color: var(--text-2);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
}

.admin-toggle {
  padding: 0 var(--sp-3);
  min-width: 104px;
}

@media (max-width: 768px) {
  .topbar {
    gap: var(--sp-2);
    padding: 10px calc(14px + env(safe-area-inset-right, 0px)) 10px
      calc(14px + env(safe-area-inset-left, 0px));
  }

  .menu-btn {
    display: inline-flex;
  }

  .brand-name {
    display: none;
  }

  .search {
    margin: 0;
  }

  .search kbd {
    display: none;
  }

  .admin-toggle {
    padding: 0 10px;
    min-width: 96px;
    font-size: var(--fs-sm);
  }
}

@media (max-width: 420px) {
  .topbar {
    gap: var(--sp-1);
  }
}
</style>
