<script setup>
/**
 * 站点卡片：图标（favicon 自动获取 + 多级回退到字母头像）、名称、描述、域名
 */
import { ref, computed } from 'vue'

const props = defineProps({
  site: { type: Object, required: true },
  admin: { type: Boolean, default: false },
})

defineEmits(['edit', 'remove'])

/** 字母头像配色板 */
const PALETTE = ['#4f7cff', '#9b5cff', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

const iconFailed = ref(false)

const domain = computed(() => {
  try {
    return new URL(props.site.url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
})

/** 自动 favicon 地址（icon 留空时使用） */
const autoIcon = computed(() => (domain.value ? `https://favicon.im/${domain.value}?larger=true` : ''))

const showImg = computed(() => !iconFailed.value && (props.site.icon || autoIcon.value))

const initial = computed(() => (props.site.name || '?').trim().charAt(0).toUpperCase())

const avatarColor = computed(() => {
  const s = props.site.name || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
})

function onImgError(e) {
  const el = e.target
  // 第一级回退：换 DuckDuckGo 图标服务
  if (!el.dataset.fallback && domain.value) {
    el.dataset.fallback = '1'
    el.src = `https://icons.duckduckgo.com/ip3/${domain.value}.ico`
  } else {
    iconFailed.value = true
  }
}
</script>

<template>
  <a class="card" :href="site.url" target="_blank" rel="noopener noreferrer" :title="site.desc || site.name">
    <span class="icon">
      <img v-if="showImg" :src="site.icon || autoIcon" alt="" loading="lazy" @error="onImgError" />
      <span v-else class="avatar" :style="{ background: avatarColor }">{{ initial }}</span>
    </span>
    <span class="meta">
      <span class="name">{{ site.name }}</span>
      <span class="desc">{{ site.desc || domain }}</span>
    </span>
    <span v-if="admin" class="ops">
      <button class="op" aria-label="编辑站点" @click.prevent="$emit('edit')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>
      <button class="op danger" aria-label="删除站点" @click.prevent="$emit('remove')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      </button>
    </span>
  </a>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}

.icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.icon img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.avatar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 17px;
  font-weight: 600;
}

.meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desc {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ops {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  gap: 2px;
  padding: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.card:hover .ops {
  display: flex;
}

.op {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
}

.op:hover {
  background: var(--surface-hover);
  color: var(--accent);
}

.op.danger:hover {
  color: var(--danger);
}

@media (hover: none) {
  .ops {
    display: flex;
  }
}
</style>
