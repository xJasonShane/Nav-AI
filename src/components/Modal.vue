<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { lockScroll, unlockScroll } from '../utils/scroll-lock.js'
import Icon from './Icon.vue'

const props = defineProps({
  title: { type: String, required: true },
  width: { type: Number, default: 480 },
})

const emit = defineEmits(['close'])

const boxRef = ref(null)
let lastActive = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function onKey(e) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !boxRef.value) return

  // 焦点陷阱：Tab 在弹窗内循环
  const nodes = Array.from(boxRef.value.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  )
  if (!nodes.length) return

  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement

  if (e.shiftKey && (active === first || active === boxRef.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(async () => {
  lastActive = document.activeElement
  document.addEventListener('keydown', onKey)
  lockScroll()
  await nextTick()
  // 优先聚焦标注了 data-autofocus 的元素，否则聚焦对话框容器
  const target = boxRef.value?.querySelector('[data-autofocus]') || boxRef.value
  target?.focus?.()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  unlockScroll()
  if (lastActive && document.contains(lastActive)) lastActive.focus?.()
})
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩是对话框的父级，不能加 aria-hidden（会连同对话框一起对读屏隐藏）；弹窗语义由内部 role="dialog" + aria-modal 承担 -->
    <div class="modal-mask" @mousedown.self="emit('close')">
      <div
        ref="boxRef"
        class="modal-box"
        :style="{ maxWidth: width + 'px' }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <header class="modal-head">
          <h3>{{ title }}</h3>
          <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
            <Icon name="close" :size="16" :stroke="2.2" />
          </button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--mask);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: calc(env(safe-area-inset-top, 0px) + 8vh) var(--sp-4)
    calc(env(safe-area-inset-bottom, 0px) + var(--sp-4));
  overflow-y: auto;
  /* 弹窗内滚动到边界时不把滚动传递给背后的页面（配合滚动锁，移动端更稳） */
  overscroll-behavior: contain;
}

.modal-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-height: 86vh;
  max-height: 86dvh;
  display: flex;
  flex-direction: column;
  animation: pop-in var(--dur-2) var(--ease-out);
}

.modal-box:focus,
.modal-box:focus-visible {
  outline: none;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(10px);
  }
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5) 0;
}

.modal-head h3 {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  line-height: var(--lh-tight);
}

.modal-body {
  padding: var(--sp-4) var(--sp-5);
  overflow-y: auto;
}

.modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-3);
  padding: 0 var(--sp-5) var(--sp-5);
}
</style>
