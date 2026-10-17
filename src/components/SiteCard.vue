<script setup>
/**
 * 站点卡片：
 *  - 图标：自定义图标 → 站点自身 /favicon.ico → 图标服务 → 字母头像（前两者的顺序随 settings.iconSource 调整）
 *  - 结构：容器 + 整卡链接（stretched-link）+ 管理操作浮层，保证键盘可达
 *  - 排序模式（order）：显示 ↑↓ 按钮并支持拖拽，跨分组拖拽即等于移动分类
 */
import { ref, computed, watch } from 'vue'
import Icon from './Icon.vue'
import { store, sitesOf, moveSite, moveSiteRelative } from '../store/data.js'
import { isHttpUrl } from '../utils/url.js'
import { cachedStep, rememberStep } from '../utils/favicon.js'
import { draggingId, dropTargetId, dropAfter, resetDrag } from '../utils/drag.js'

const props = defineProps({
  site: { type: Object, required: true },
  admin: { type: Boolean, default: false },
  /** 排序模式：卡片可拖拽，操作区换成 ↑↓ */
  order: { type: Boolean, default: false },
  /** 批量模式：整卡作为可勾选目标 */
  bulk: { type: Boolean, default: false },
  /** 批量模式下的选中态 */
  selected: { type: Boolean, default: false },
  /** 命令面板式搜索中的当前选中项 */
  active: { type: Boolean, default: false },
  /** 所属分类名（仅搜索结果传入，用于补充上下文） */
  categoryName: { type: String, default: '' },
})

defineEmits(['edit', 'remove', 'toggle-select'])

/** 字母头像配色板 */
const PALETTE = ['#4f7cff', '#9b5cff', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

const iconFailed = ref(false)
const loaded = ref(false)
/** 图标回退链当前级别 */
const step = ref(0)

const domain = computed(() => {
  try {
    return new URL(props.site.url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
})

/** 图标候选链：自定义图标优先；否则按设置决定「直连站点图标」与「第三方图标服务」的先后 */
const sources = computed(() => {
  if (props.site.icon) return [props.site.icon]
  const d = domain.value
  if (!d) return []
  const direct = `https://${d}/favicon.ico`
  const service = `https://favicon.im/${d}?larger=true`
  return store.settings.iconSource === 'service' ? [service, direct] : [direct, service]
})

const currentSrc = computed(() => sources.value[step.value] || '')
const showImg = computed(() => !iconFailed.value && !!currentSrc.value)

/** 只有合法 http(s) 才渲染整卡链接：空值或伪协议会让卡片不可点击（避免 href="" 刷新当前页） */
const linkReady = computed(() => !props.order && !props.bulk && isHttpUrl(props.site.url))

/** 同域名共享图标解析结果；自定义图标或无效域名不参与缓存 */
const cacheKey = computed(() =>
  props.site.icon || !domain.value ? '' : `${domain.value}|${store.settings.iconSource}`
)

// 站点被编辑、或图标源设置变化后重置回退链：否则上一次的失败结果会被永久沿用，
// 用户补填图标地址后仍只显示字母头像，必须刷新才恢复。
// 命中缓存时直接采用已知档位（-1 表示该域名全部失败，直接显示字母头像，不再发请求）
watch(
  () => [props.site.icon, props.site.url, store.settings.iconSource],
  () => {
    const hit = cachedStep(cacheKey.value)
    step.value = hit && hit > 0 ? hit : 0
    iconFailed.value = hit === -1
    loaded.value = false
  },
  { immediate: true }
)

const initial = computed(() => (props.site.name || '?').trim().charAt(0).toUpperCase())

const avatarColor = computed(() => {
  const s = props.site.name || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
})

function onImgError() {
  if (step.value < sources.value.length - 1) {
    step.value += 1
    // 记住「直连失败、已降级」的结论，同域名的其它卡片可少发一次请求
    rememberStep(cacheKey.value, step.value)
  } else {
    iconFailed.value = true
    rememberStep(cacheKey.value, -1)
  }
}

/* ---------------- 排序模式：↑↓ 与拖拽 ---------------- */

const siblings = computed(() => sitesOf(props.site.categoryId))
const position = computed(() => siblings.value.findIndex((s) => s.id === props.site.id))
const canMoveUp = computed(() => position.value > 0)
const canMoveDown = computed(
  () => position.value >= 0 && position.value < siblings.value.length - 1
)

const dragging = computed(() => draggingId.value === props.site.id)
const isDropTarget = computed(
  () => !!draggingId.value && draggingId.value !== props.site.id && dropTargetId.value === props.site.id
)

function onDragStart(e) {
  if (!props.order) return
  draggingId.value = props.site.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', props.site.id)
  }
}

function onDragOver(e) {
  if (!props.order || !draggingId.value || draggingId.value === props.site.id) return
  const rect = e.currentTarget.getBoundingClientRect()
  dropAfter.value = e.clientX - rect.left > rect.width / 2
  dropTargetId.value = props.site.id
}

function onDrop(e) {
  // 卡片内的放置优先于分组容器：阻止冒泡，避免同一次拖拽被「移动到目标站点分类」和
  // 「移动到分组分类」先后执行两次
  e.stopPropagation()
  if (!props.order || !draggingId.value) return
  moveSiteRelative(draggingId.value, props.site.id, dropAfter.value)
  resetDrag()
}
</script>

<template>
  <article
    class="card"
    :class="{
      'is-active': active,
      'is-selected': bulk && selected,
      dragging,
      'drop-target': isDropTarget,
      'drop-after': isDropTarget && dropAfter,
    }"
    :role="bulk ? 'checkbox' : undefined"
    :aria-checked="bulk ? String(selected) : undefined"
    :tabindex="bulk ? 0 : undefined"
    :draggable="order ? 'true' : 'false'"
    @click="bulk && $emit('toggle-select')"
    @keydown.space.prevent="bulk && $emit('toggle-select')"
    @keydown.enter.prevent="bulk && $emit('toggle-select')"
    @dragstart="onDragStart"
    @dragover.prevent="onDragOver"
    @drop.prevent="onDrop"
    @dragend="resetDrag"
  >
    <input v-if="bulk" class="pick" type="checkbox" :checked="selected" tabindex="-1" aria-hidden="true" />

    <span class="icon" aria-hidden="true">
      <img
        v-if="showImg"
        :key="currentSrc"
        :src="currentSrc"
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        :class="{ loaded }"
        @load="loaded = true"
        @error="onImgError"
      />
      <span v-else class="avatar" :style="{ background: avatarColor }">{{ initial }}</span>
    </span>

    <span class="meta">
      <span class="name">{{ site.name }}</span>
      <span v-if="categoryName" class="badge cat-badge">{{ categoryName }}</span>
      <span v-if="store.settings.showDesc" class="desc">{{ site.desc || domain }}</span>
    </span>

    <a
      v-if="linkReady"
      class="card-link"
      :href="site.url"
      target="_blank"
      rel="noopener noreferrer"
      draggable="false"
      :aria-label="site.desc ? `${site.name}：${site.desc}` : site.name"
    ></a>

    <span v-if="order" class="ops order-ops">
      <button
        class="icon-btn-sm op"
        type="button"
        title="上移"
        aria-label="上移"
        :disabled="!canMoveUp"
        @click="moveSite(site.id, -1)"
      >
        <Icon name="up" />
      </button>
      <button
        class="icon-btn-sm op"
        type="button"
        title="下移"
        aria-label="下移"
        :disabled="!canMoveDown"
        @click="moveSite(site.id, 1)"
      >
        <Icon name="down" />
      </button>
    </span>

    <span v-else-if="admin && !bulk" class="ops">
      <button class="icon-btn-sm op" type="button" aria-label="编辑站点" title="编辑" @click="$emit('edit')">
        <Icon name="edit" />
      </button>
      <button class="icon-btn-sm op danger" type="button" aria-label="删除站点" title="删除" @click="$emit('remove')">
        <Icon name="trash" />
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
  transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2), border-color var(--dur-2), opacity var(--dur-2);
}

.card[draggable='true'] {
  cursor: grab;
}

/* 批量模式：整卡可勾选 */
.card[role='checkbox'] {
  cursor: pointer;
}

.pick {
  position: absolute;
  top: var(--sp-3);
  left: var(--sp-3);
  z-index: 2;
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  pointer-events: none;
}

.card[role='checkbox'] .icon {
  margin-left: 22px;
}

.card.is-selected {
  border-color: var(--accent);
  background: var(--accent-weak);
}

/* 紧凑密度：更小的卡片内边距与图标容器（由设置里的卡片密度驱动） */
html[data-density='compact'] .card {
  padding: var(--sp-2) var(--sp-3);
  gap: var(--sp-2);
}

html[data-density='compact'] .icon {
  width: 32px;
  height: 32px;
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

/* 命令面板式搜索的当前项 */
.card.is-active {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card.is-active .name {
  color: var(--accent);
}

/* 拖拽中的卡片与落点指示 */
.card.dragging {
  opacity: 0.45;
}

.card.drop-target {
  border-color: var(--accent);
}

.card.drop-target::before {
  content: '';
  position: absolute;
  top: var(--sp-2);
  bottom: var(--sp-2);
  left: -3px;
  width: 3px;
  border-radius: var(--radius-pill);
  background: var(--accent);
}

.card.drop-target.drop-after::before {
  left: auto;
  right: -3px;
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

/* 搜索结果里的所属分类：复用 .badge 外观，只做对齐与截断 */
.cat-badge {
  align-self: flex-start;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.op:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.op:disabled:hover {
  background: none;
  color: var(--text-2);
}

.op.danger:hover {
  color: var(--danger);
}

/* 排序模式下 ↑↓ 常显（排序是显式进入的模式，不隐藏） */
.order-ops {
  opacity: 1;
}

/* 桌面端悬停/聚焦时显现操作；触摸设备常显；排序模式的 ↑↓ 始终可见 */
@media (hover: hover) {
  .ops:not(.order-ops) {
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
