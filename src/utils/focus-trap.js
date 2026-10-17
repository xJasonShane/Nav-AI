/**
 * 焦点陷阱（弹窗与移动端抽屉共用）：
 *  - FOCUSABLE：可聚焦元素选择器
 *  - focusables：容器内当前可见的可聚焦元素
 *  - trapTab：Tab / Shift+Tab 到边界时在容器内循环，返回 true 表示事件已接管
 */

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusables(root) {
  if (!root) return []
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  )
}

export function trapTab(root, event) {
  const nodes = focusables(root)
  if (!nodes.length) return false

  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement

  if (event.shiftKey && (active === first || active === root)) {
    event.preventDefault()
    last.focus()
    return true
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
    return true
  }
  return false
}
