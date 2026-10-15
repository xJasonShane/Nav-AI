/**
 * 轻量全局提示（toast）：用于「删除后撤销」与批量导入结果这类一次性反馈。
 * 单条显示，可带一个操作按钮；超时自动收起。
 */
import { ref } from 'vue'

export const toast = ref(null) // { text, actionLabel?, onAction?, timeout } | null

let timer = 0

/**
 * @param {string} text 提示文案
 * @param {{ label: string, run: () => void }} [action] 可选操作（如「撤销」）
 * @param {number} [duration] 自定义停留时长（毫秒）
 */
export function showToast(text, action, duration) {
  clearTimeout(timer)
  toast.value = { text, action }
  const ms = duration ?? (action ? 6000 : 3200)
  timer = setTimeout(() => {
    toast.value = null
  }, ms)
}

/** 执行提示上的操作并立即收起 */
export function runToastAction() {
  const action = toast.value?.action
  hideToast()
  action?.run?.()
}

export function hideToast() {
  clearTimeout(timer)
  toast.value = null
}
