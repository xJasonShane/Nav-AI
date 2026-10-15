/**
 * 滚动锁定（引用计数）：
 * 弹窗与移动端抽屉可能同时打开，用计数避免互相解锁导致背景可滚动。
 */
let locks = 0

export function lockScroll() {
  locks += 1
  if (locks === 1) document.body.style.overflow = 'hidden'
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1)
  if (locks === 0) document.body.style.overflow = ''
}
