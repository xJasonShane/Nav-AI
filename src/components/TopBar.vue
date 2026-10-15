<script setup>
import { computed } from 'vue'
import { store, applyTheme } from '../store/data.js'

const props = defineProps({
  query: { type: String, default: '' },
  admin: { type: Boolean, default: false },
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
    <button class="icon-btn menu-btn" aria-label="打开分类菜单" @click="emit('toggle-sidebar')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    </button>

    <a class="brand" href="#">
      <span class="logo">
        <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
          <g transform="rotate(45 32 32)">
            <path d="M32 14 L37.4 32 L32 50 L26.6 32 Z" fill="#fff" />
            <path d="M32 50 L26.6 32 L32 32 Z" fill="rgba(16,32,88,.28)" />
          </g>
          <circle cx="32" cy="32" r="3.2" fill="#fff" />
        </svg>
      </span>
      <span class="brand-name">{{ store.settings.title }}</span>
    </a>

    <div class="search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        :value="query"
        placeholder="搜索站点名称、描述或网址…"
        @input="emit('update:query', $event.target.value)"
      />
      <kbd v-if="!query">/</kbd>
    </div>

    <div class="actions">
      <button class="icon-btn" :title="themeLabel[store.settings.theme]" aria-label="切换主题" @click="cycleTheme">
        <svg v-if="themeIcon === 'auto'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
        <svg v-else-if="themeIcon === 'light'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
        <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </button>

      <button class="icon-btn" title="数据管理（导入 / 导出）" aria-label="数据管理" @click="emit('open-data')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      </button>

      <button class="btn admin-toggle" :class="admin ? 'btn-primary' : 'btn-ghost'" @click="emit('toggle-admin')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
  gap: 12px;
  padding: 12px 20px;
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.menu-btn {
  display: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-shrink: 0;
  min-width: 0;
}

.logo {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 10px rgb(79 124 255 / 0.4);
  flex-shrink: 0;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
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
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-3);
  transition: border-color 0.15s, box-shadow 0.15s;
  margin: 0 auto;
}

.search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.search input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13.5px;
  color: var(--text);
  min-width: 0;
}

.search input::placeholder {
  color: var(--text-3);
}

.search kbd {
  font-size: 11px;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-soft);
  color: var(--text-3);
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.admin-toggle {
  padding: 7px 14px;
}

@media (max-width: 768px) {
  .topbar {
    padding: 10px 14px;
    gap: 8px;
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

  .admin-toggle {
    padding: 7px 10px;
    font-size: 13px;
  }
}
</style>
