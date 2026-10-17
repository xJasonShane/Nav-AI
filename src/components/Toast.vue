<script setup>
/**
 * 全局提示条（toast）：单条显示，可带一个操作按钮（如删除后的「撤销」）。
 * 位置固定在底部居中，避开 FAB 与移动端安全区；悬停 / 聚焦时暂停计时。
 */
import { toast, runToastAction, hideToast, pauseToast, resumeToast } from '../utils/toast.js'
import Icon from './Icon.vue'

/** 焦点在提示内部移动时不恢复计时，真正离开后再恢复 */
function onFocusOut(event) {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !event.currentTarget.contains(next)) resumeToast()
}
</script>

<template>
  <div
    v-if="toast"
    class="toast"
    role="status"
    aria-live="polite"
    @mouseenter="pauseToast"
    @mouseleave="resumeToast"
    @focusin="pauseToast"
    @focusout="onFocusOut"
  >
    <span class="toast-text">{{ toast.text }}</span>
    <button v-if="toast.action" class="btn toast-action" type="button" @click="runToastAction">
      {{ toast.action.label }}
    </button>
    <button class="icon-btn-sm toast-close" type="button" aria-label="关闭提示" @click="hideToast">
      <Icon name="close" />
    </button>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--sp-6) + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 110;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  max-width: min(560px, calc(100vw - var(--sp-8)));
  padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-4);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-lg);
  animation: toast-in var(--dur-2) var(--ease-out);
}

.toast-text {
  font-size: var(--fs-sm);
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-action {
  height: var(--control-h-sm);
  padding: 0 var(--sp-3);
  font-size: var(--fs-sm);
  color: var(--accent-text);
  background: var(--accent-weak);
  flex-shrink: 0;
}

.toast-action:hover {
  color: var(--accent-text);
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.toast-close {
  color: var(--text-3);
  flex-shrink: 0;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
}
</style>
