/**
 * 轻量全局提示（toast）：用于「删除后撤销」、导入结果与版本更新通知。
 *  - 单条显示，可带一个操作按钮
 *  - 优先级：high（撤销）> normal（结果）> low（版本更新）
 *    低优先级不会抢占高优先级，排队等待当前提示收起后再显示
 *  - 悬停 / 聚焦时暂停计时，避免用户还没读完提示就消失
 */
import { ref } from 'vue'

export const toast = ref(null) // { text, action, level } | null

const LEVELS = { low: 0, normal: 1, high: 2 }
const DEFAULT_DURATION = 3200

let timer = 0
let deadline = 0
let remaining = 0
let paused = false
let queued = null

function startTimer(ms) {
  clearTimeout(timer)
  remaining = ms
  deadline = Date.now() + ms
  timer = setTimeout(hideToast, ms)
}

function render(item) {
  toast.value = { text: item.text, action: item.action, level: item.level }
  if (paused) {
    clearTimeout(timer)
    timer = 0
    remaining = item.duration
    deadline = Date.now() + remaining
    return
  }
  startTimer(item.duration)
}

/**
 * @param {string} text 提示文案
 * @param {{ label: string, run: () => void }} [action] 可选操作（如「撤销」）
 * @param {number} [duration] 自定义停留时长（毫秒）
 * @param {'low'|'normal'|'high'} [priority] 优先级，默认 normal
 */
export function showToast(text, action, duration, priority = 'normal') {
  const level = LEVELS[priority] ?? LEVELS.normal
  const item = {
    text,
    action,
    level,
    duration: duration ?? (action ? 6000 : DEFAULT_DURATION),
  }
  // 撤销等关键提示绝不被版本更新之类的低优先级提示顶掉
  if (toast.value && toast.value.level > level) {
    queued = item
    return
  }
  render(item)
}

/** 撤销类提示：固定高优先级，保证 6 秒撤销窗口不被其它提示抢占 */
export function showUndo(text, run, label = '撤销') {
  showToast(text, { label, run }, undefined, 'high')
}

/** 悬停 / 聚焦时暂停计时 */
export function pauseToast() {
  if (!toast.value || !timer) return
  paused = true
  clearTimeout(timer)
  timer = 0
  remaining = Math.max(0, deadline - Date.now())
}

/** 离开后恢复剩余时间；剩余过短时至少再留 1.2 秒 */
export function resumeToast() {
  if (!toast.value) return
  paused = false
  if (timer) return
  startTimer(remaining > 0 ? remaining : 1200)
}

/** 执行提示上的操作并立即收起 */
export function runToastAction() {
  const action = toast.value?.action
  hideToast()
  action?.run?.()
}

export function hideToast() {
  clearTimeout(timer)
  timer = 0
  remaining = 0
  paused = false
  toast.value = null
  // 当前提示收起后再显示排队中的低优先级通知
  if (queued) {
    const next = queued
    queued = null
    render(next)
  }
}
