<script setup>
/**
 * 统一确认卡：全站唯一的二次确认样式（替代原生 confirm 与各处自建确认块）。
 * 无障碍：容器 role="alert" 让读屏感知到「需要确认」；出现时把焦点放到「取消」（安全选项）。
 * 放在 Modal 内时，「取消」按钮带 data-autofocus，可复用 Modal 的自动聚焦机制。
 */
import { onMounted, ref } from 'vue'

defineProps({
  /** 确认按钮文案 */
  confirmText: { type: String, default: '确认' },
  /** 危险操作（实底红按钮） */
  danger: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

const cancelRef = ref(null)

onMounted(() => cancelRef.value?.focus?.())
</script>

<template>
  <div class="confirm" role="alert">
    <p><slot /></p>
    <div class="confirm-ops">
      <button ref="cancelRef" class="btn btn-ghost" type="button" data-autofocus @click="emit('cancel')">
        取消
      </button>
      <button
        class="btn"
        :class="danger ? 'btn-danger-solid' : 'btn-primary'"
        type="button"
        @click="emit('confirm')"
      >
        {{ confirmText }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.confirm {
  padding: var(--sp-4);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  background: color-mix(in srgb, var(--danger) 6%, var(--surface));
  border-radius: var(--radius-sm);
}

.confirm p {
  font-size: var(--fs-sm);
  color: var(--text-2);
  line-height: var(--lh-relaxed);
}

.confirm-ops {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
</style>
