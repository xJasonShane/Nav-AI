<script setup>
/**
 * 统一空状态：装饰图标 / 标题 / 说明 / 操作（默认插槽）。
 * 传 title 时为「完整态」（首屏欢迎），不传时为「精简态」（搜索结果为空、分类为空）。
 */
defineProps({
  /** 装饰 emoji */
  icon: { type: String, default: '📭' },
  /** 主标题（可选） */
  title: { type: String, default: '' },
  /** 说明文案 */
  desc: { type: String, default: '' },
})
</script>

<template>
  <div class="empty-state" :class="{ small: !title }">
    <div class="empty-logo" aria-hidden="true">{{ icon }}</div>
    <h2 v-if="title" class="empty-title">{{ title }}</h2>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--sp-3);
  padding: 72px var(--sp-5) var(--sp-6);
}

.empty-state.small {
  padding: var(--sp-8) var(--sp-5);
  gap: var(--sp-2);
}

.empty-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  font-size: 32px; /* emoji 装饰图标：尺寸随容器刻意放大，不入字号阶梯 */
  line-height: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}

.empty-state.small .empty-logo {
  width: 52px;
  height: 52px;
  font-size: 26px;
}

.empty-title {
  font-size: var(--fs-2xl);
  font-weight: var(--fw-bold);
  line-height: var(--lh-tight);
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.empty-desc {
  color: var(--text-2);
  font-size: var(--fs-md);
  line-height: var(--lh-relaxed);
  max-width: 400px;
}

@media (max-width: 480px) {
  .empty-state {
    padding: var(--sp-8) var(--sp-4) var(--sp-5);
  }
}
</style>
