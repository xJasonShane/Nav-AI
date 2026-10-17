/**
 * 运行时异常兜底：组件渲染错误 / 未捕获脚本错误 / 未处理的 Promise 拒绝。
 * 纯静态应用没有服务端日志，异常必须变成用户可见、可自救（导出备份）的提示，而不是白屏。
 */
import { ref } from 'vue'

/** 最近一次运行时异常（由 App.vue 顶栏下方提示条展示） */
export const runtimeError = ref('')

function describe(error) {
  if (!error) return '未知错误'
  const message = typeof error === 'string' ? error : error.message
  return String(message || error.name || '未知错误').slice(0, 160)
}

/** 记录异常；同一时间只保留最后一条，避免提示刷屏 */
export function reportError(error, context = '') {
  runtimeError.value = `页面运行异常${context ? `（${context}）` : ''}：${describe(error)}。建议先导出备份，再刷新重试。`
  // 控制台保留原始对象与堆栈，便于排查；提示条不展示堆栈
  console.error('[nav-ai]', error)
}

export function clearRuntimeError() {
  runtimeError.value = ''
}
