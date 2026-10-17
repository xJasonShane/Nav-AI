/**
 * 全局提示优先级测试（零依赖）：
 * 撤销类提示必须压过版本更新等低优先级通知，低优先级提示排队等待。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { toast, showToast, showUndo, hideToast } from '../src/utils/toast.js'

test('toast：撤销提示不被低优先级更新通知抢占，更新排队', () => {
  showUndo('已删除「A」', () => {})
  showToast('应用已更新', { label: '刷新', run: () => {} }, undefined, 'low')
  assert.equal(toast.value.text, '已删除「A」', '撤销提示应先显示')

  hideToast()
  assert.equal(toast.value.text, '应用已更新', '撤销提示收起后显示排队的更新通知')

  hideToast()
  assert.equal(toast.value, null)
})

test('toast：普通提示可顶掉低优先级，但撤销提示始终优先', () => {
  showToast('后台同步完成', null, undefined, 'low')
  showToast('导入完成')
  assert.equal(toast.value.text, '导入完成', '普通提示可以顶掉低优先级')

  showUndo('已删除「B」', () => {})
  showToast('另一个结果')
  assert.equal(toast.value.text, '已删除「B」', '撤销提示不能被普通结果顶掉')

  hideToast()
  assert.equal(toast.value.text, '另一个结果', '被挡下的普通结果排队显示')
  hideToast()
})
