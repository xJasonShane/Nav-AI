<script setup>
/**
 * 站点卡片：图标（favicon 自动获取 + 多级回退到字母头像）、名称、描述、域名
 * 结构：容器 + 整卡链接（stretched-link）+ 管理操作浮层，保证键盘可达
 */
import { ref, computed, watch } from 'vue'

const props = defineProps({
  site: { type: Object, required: true },
  admin: { type: Boolean, default: false },
})

defineEmits(['edit', 'remove'])

/** 字母头像配色板 */
const PALETTE = ['#4f7cff', '#9b5cff', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

const iconFailed = ref(false)
const loaded = ref(false)

// 站点被编辑（图标地址 / 网址变化）后重置图标状态：否则上一次的失败结果会被永久沿用，
// 用户补填图标地址后仍只显示字母头像，必须刷新才恢复
watch(
  () => [props.site.icon, props.site.url],
  () => {
    iconFailed.value = false
    loaded.value = false
  }
)

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
  <article class="card">
    <span class="icon" aria-hidden="true">
      <img
        v-if="showImg"
        :key="site.icon || autoIcon"
        :src="site.icon || autoIcon"
        alt=""
        loading="lazy"
        decoding="async"
        :class="{ loaded }"
        @load="loaded = true"
        @error="onImgError"
      />
      <span v-else class="avatar" :style="{ background: avatarColor }">{{ initial }}</span>
    </span>

    <span class="meta">
      <span class="name">{{ site.name }}</span>
      <span class="desc">{{ site.desc || domain }}</span>
    </span>

    <a
      class="card-link"
      :href="site.url"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="site.desc ? `${site.name}：${site.desc}` : site.name"
    ></a>

    <span v-if="admin" class="ops">
      <button class="icon-btn-sm op" type="button" aria-label="编辑站点" title="编辑" @click="$emit('edit')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>
      <button class="icon-btn-sm op danger" type="button" aria-label="删除站点" title="删除" @click="$emit('remove')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      </button>
    </span>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2), border-color var(--dur-2);
}

.card:hover,
.card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}

.card:hover .name,
.card:focus-within .name {
  color: var(--accent);
}

/* 整卡链接：覆盖卡片，保持“点击卡片打开新标签”的行为 */
.card-link {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
}

.icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  transition: box-shadow var(--dur-2);
}

.icon img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  opacity: 0;
  transition: transform var(--dur-2) var(--ease-out), opacity var(--dur-2);
}

.icon img.loaded {
  opacity: 1;
}

.card:hover .icon img,
.card:focus-within .icon img {
  transform: scale(1.08);
}

.card:hover .icon,
.card:focus-within .icon {
  box-shadow: 0 0 0 3px var(--accent-weak);
}

.avatar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  transition: transform var(--dur-2) var(--ease-out);
}

.card:hover .avatar,
.card:focus-within .avatar {
  transform: scale(1.06);
}

.meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--dur-1);
}

.desc {
  font-size: var(--fs-xs);
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ops {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: flex;
  gap: 6px;
  padding: var(--sp-1);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
}

.op {
  position: relative;
}

.op::after {
  content: '';
  position: absolute;
  inset: -3px;
}

.op:hover {
  background: var(--surface-hover);
  color: var(--accent);
}

.op.danger:hover {
  color: var(--danger);
}

/* 桌面端悬停/聚焦时显现操作；触摸设备常显 */
@media (hover: hover) {
  .ops {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-1);
  }

  .card:hover .ops,
  .card:focus-within .ops {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
