/**
 * 工程约束自检（零依赖，直接 `node scripts/check.mjs`）：
 *  1) 设计令牌收口：组件内不得出现裸字号 / 裸圆角 / 裸动效时长
 *  2) 品牌色不得散落到组件（只允许定义在 src/style.css 的令牌区）
 *  3) 禁用 v-html（纯静态应用的 XSS 面）
 *  4) 依赖白名单：运行时仅 vue，开发期仅 vite + @vitejs/plugin-vue
 *  5) 构建特性标志必须保留（Vue Options API / DEVTOOLS 关闭）
 *  6) STORAGE_KEY 口径一致（index.html 内联脚本与数据层）
 *  7) 功能图标集中维护：已收口的路径不得再复制回组件
 *  8) 主色预设与样式表一致（data.js 的 ACCENT_PRESETS ↔ style.css 的 data-accent 选择器）
 *  9) 无 console.log 残留
 * 10) SFC 的 <style> 必须 scoped（避免样式泄漏到全局）
 * 11) 产物体积预算（需先 npm run build，缺失则跳过）
 *
 * 约定来源：docs/ui-audit-and-plan.md 第 5 / 7 节与 MEMORY.md 的硬性约定。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const readLines = (file) =>
  readFileSync(file, 'utf8').split('\n').map((text, i) => ({ no: i + 1, text }))

/**
 * 体积预算（gzip 后字节数）。
 * 历史（每次上调都是显式决策，记录在此）：
 *   - UI 审计期：CSS 6 kB / JS 44 kB
 *   - 批次 2（F1 排序 / F2 命令面板 / F4 批量与书签导入 / F5 设置）：CSS 经等量去重后维持 6 kB，JS → 48 kB
 *   - 批次 3（F6 批量管理 / F8 PWA / F9 分享页 / F10 密度与描述开关 / E4 强制高对比 / C5 逻辑分层）：
 *     CSS → 6.5 kB，JS → 52 kB
 *   - 批次 S2（弹窗按需加载）：JS 改为「入口 + 静态依赖」的首屏口径，按需 chunk 不计入
 * 当前实测值见每次输出（余量会一并打印）。
 */
const BUDGET = { css: 6.5 * 1024, js: 52 * 1024 }
/** 允许保留裸值的白名单（按文件 → 正则） */
const TOKEN_ALLOW = {
  'src/components/EmptyState.vue': [/font-size:\s*\d+px/], // emoji 装饰图标尺寸
  'src/App.vue': [/animation:\s*fab-pulse\s+[\d.]+s/], // FAB 脉冲（限 3 次）
  'src/components/SideBar.vue': [/visibility\s+0s/], // 抽屉延迟隐藏
}
/** 必须集中维护在 Icon.vue 的图标路径 */
const CENTRAL_PATHS = [
  'M12 5v14M5 12h14',
  'M18 6 6 18M6 6l12 12',
  'M20 6 9 17l-5-5',
  'M12 19V5M5 12l7-7 7 7',
  'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
]

/** #rrggbb → 相对亮度（WCAG 2.x） */
function luminance(hex) {
  const channels = hex
    .replace('#', '')
    .match(/../g)
    .map((part) => parseInt(part, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** 与白字的对比度（主色实底按钮/FAB 的前景色固定为白） */
function contrastOnWhite(hex) {
  return 1.05 / (luminance(hex) + 0.05)
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const srcFiles = walk(join(ROOT, 'src'))
const vueFiles = srcFiles.filter((f) => extname(f) === '.vue')

const results = []

function check(name, run) {
  let problems = []
  try {
    problems = run() || []
  } catch (e) {
    problems = [`检查执行失败：${e.message}`]
  }
  results.push({ name, problems })
}

check('设计令牌收口（字号 / 圆角 / 动效时长）', () => {
  const rules = [
    ['裸字号', /font-size:\s*\d/],
    ['裸圆角', /border-radius:[^;]*\d+(px|rem|em)/],
    ['裸动效时长', /(?:transition|animation):[^;]*\d+\.?\d*s\b/],
  ]
  const bad = []
  for (const file of vueFiles) {
    const key = rel(file)
    const allow = TOKEN_ALLOW[key] || []
    for (const { no, text } of readLines(file)) {
      if (/^\s*(\/\*|\*)/.test(text)) continue
      for (const [label, re] of rules) {
        if (!re.test(text) || allow.some((a) => a.test(text))) continue
        bad.push(`${key}:${no} ${label} → ${text.trim()}`)
      }
    }
  }
  return bad
})

check('品牌色不散落到组件', () => {
  const bad = []
  for (const file of srcFiles) {
    const key = rel(file)
    if (key === 'src/style.css') continue
    for (const { no, text } of readLines(file)) {
      if (text.includes('rgb(79 124 255')) bad.push(`${key}:${no} → ${text.trim()}`)
    }
  }
  return bad
})

check('禁用 v-html 与原生 confirm', () => {
  const bad = []
  for (const file of srcFiles) {
    for (const { no, text } of readLines(file)) {
      if (text.includes('v-html')) bad.push(`${rel(file)}:${no} 禁用 v-html`)
      if (/\bconfirm\s*\(/.test(text)) bad.push(`${rel(file)}:${no} 请使用 ConfirmCard 替代原生 confirm`)
    }
  }
  return bad
})

check('依赖白名单（运行时仅 vue）', () => {
  const pkg = JSON.parse(read('package.json'))
  const bad = []
  const runtime = Object.keys(pkg.dependencies || {})
  if (runtime.join(',') !== 'vue') bad.push(`dependencies 应仅含 vue，当前：${runtime.join(',') || '（空）'}`)
  const dev = Object.keys(pkg.devDependencies || {}).sort()
  const expected = ['@vitejs/plugin-vue', 'vite']
  if (dev.join(',') !== expected.join(',')) bad.push(`devDependencies 应为 ${expected.join(',')}，当前：${dev.join(',')}`)
  return bad
})

check('构建特性标志（__VUE_OPTIONS_API__ / __VUE_PROD_DEVTOOLS__）', () => {
  const cfg = read('vite.config.js')
  return ['__VUE_OPTIONS_API__', '__VUE_PROD_DEVTOOLS__']
    .filter((flag) => !cfg.includes(flag))
    .map((flag) => `vite.config.js 缺少 ${flag}`)
})

check('STORAGE_KEY 口径一致（index.html ↔ 数据层）', () => {
  const key = read('src/store/data.js').match(/STORAGE_KEY = '([^']+)'/)?.[1]
  const bad = []
  if (!key) bad.push('src/store/data.js 未找到 STORAGE_KEY 定义')
  else if (!read('index.html').includes(key)) bad.push(`index.html 内联脚本未使用 ${key}`)
  return bad
})

check('功能图标集中维护（Icon.vue）', () => {
  const bad = []
  for (const file of srcFiles.filter((f) => ['.vue', '.js'].includes(extname(f)))) {
    const key = rel(file)
    if (key === 'src/components/Icon.vue') continue
    for (const { no, text } of readLines(file)) {
      for (const d of CENTRAL_PATHS) {
        if (text.includes(d)) bad.push(`${key}:${no} 图标路径应使用 <Icon>：${d.slice(0, 18)}…`)
      }
    }
  }
  return bad
})

check('主色预设与样式表一致（data.js ↔ style.css）', () => {
  const block = read('src/store/data.js').match(/ACCENT_PRESETS\s*=\s*\[([\s\S]*?)\n\]/)?.[1] || ''
  const jsKeys = [...block.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1])
  const cssKeys = [...read('src/style.css').matchAll(/html\[data-accent='([^']+)'\]/g)].map((m) => m[1])
  const bad = []
  if (!jsKeys.length) return ['data.js 未解析到 ACCENT_PRESETS']

  // 默认主色由 :root 提供，不需要 data-accent 选择器
  const expected = jsKeys.filter((key) => key !== 'default')
  const missing = expected.filter((key) => !cssKeys.includes(key))
  const extra = cssKeys.filter((key) => !expected.includes(key))
  if (missing.length) bad.push(`style.css 缺少主色选择器：${missing.join(', ')}`)
  if (extra.length) bad.push(`style.css 存在未登记的主色选择器：${extra.join(', ')}`)
  return bad
})

check('主色实底对白字对比度 ≥ 4.5:1', () => {
  const css = read('src/style.css')
  const blocks = [{ name: 'default', body: css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] || '' }]
  for (const match of css.matchAll(/html\[data-accent='([^']+)'\]\s*\{([\s\S]*?)\n\}/g)) {
    blocks.push({ name: match[1], body: match[2] })
  }

  const bad = []
  for (const { name, body } of blocks) {
    for (const token of ['--accent-solid', '--accent-solid-2']) {
      const hex = body.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
      if (!hex) {
        bad.push(`${name} 缺少 ${token}`)
        continue
      }
      const ratio = contrastOnWhite(hex)
      if (ratio < 4.5) bad.push(`${name} ${token} ${hex} 对白字仅 ${ratio.toFixed(2)}:1（需 ≥ 4.5）`)
    }
  }
  return bad
})

check('文字主色统一走 accent-text', () => {
  const bad = []
  for (const file of srcFiles.filter((f) => ['.vue', '.css'].includes(extname(f)))) {
    for (const { no, text } of readLines(file)) {
      if (/color:\s*var\(--accent\)/.test(text)) {
        bad.push(`${rel(file)}:${no} 文字应使用 var(--accent-text)，避免浅色主色对比度不足`)
      }
    }
  }
  return bad
})

check('迁移链完整（2..DATA_VERSION）', () => {
  const src = read('src/store/data.js')
  const version = Number(src.match(/export const DATA_VERSION = (\d+)/)?.[1])
  if (!version) return ['未解析到 DATA_VERSION']
  const block = src.match(/const MIGRATIONS = \{([\s\S]*?)\n\}/)?.[1] || ''
  const keys = [...block.matchAll(/^\s{2}(\d+):/gm)].map((m) => Number(m[1]))
  const bad = []
  for (let v = 2; v <= version; v += 1) {
    if (!keys.includes(v)) bad.push(`MIGRATIONS 缺少 ${v}`)
  }
  const extra = keys.filter((v) => v < 2 || v > version)
  if (extra.length) bad.push(`MIGRATIONS 存在越界键：${extra.join(', ')}`)
  if (new Set(keys).size !== keys.length) bad.push('MIGRATIONS 存在重复键')
  return bad
})

check('Icon 名称存在（<Icon name="…">）', () => {
  const icon = read('src/components/Icon.vue')
  const block = icon.match(/const PATHS = \{([\s\S]*?)\n\}/)?.[1] || ''
  const names = new Set([...block.matchAll(/^\s{2}([a-zA-Z]+):/gm)].map((m) => m[1]))
  if (!names.size) return ['未解析到 Icon PATHS']

  const bad = []
  for (const file of vueFiles) {
    if (rel(file) === 'src/components/Icon.vue') continue
    for (const { no, text } of readLines(file)) {
      for (const match of text.matchAll(/<Icon\b[^>]*?(?<!:)name="([^"]+)"/g)) {
        if (!names.has(match[1])) bad.push(`${rel(file)}:${no} 未定义的图标：${match[1]}`)
      }
    }
  }
  return bad
})

check('虚拟视图已注册（grouping ↔ useNavView）', () => {
  const nav = read('src/composables/useNavView.js')
  const block = nav.match(/VIRTUAL_VIEWS = new Set\(\[([\s\S]*?)\]\)/)?.[1] || ''
  const registered = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])
  if (!registered.length) return ['未解析到 VIRTUAL_VIEWS']

  const grouping = read('src/utils/grouping.js')
  const used = [...new Set([...grouping.matchAll(/selectedId === '([^']+)'/g)].map((m) => m[1]))]
  const bad = []
  for (const id of used) if (!registered.includes(id)) bad.push(`grouping 使用 ${id} 但未在 VIRTUAL_VIEWS 注册`)
  for (const id of registered) if (!used.includes(id)) bad.push(`VIRTUAL_VIEWS 注册了 ${id} 但 grouping 未处理`)
  return bad
})

check('无 console.log 残留', () => {
  const bad = []
  for (const file of srcFiles.filter((f) => ['.js', '.vue'].includes(extname(f)))) {
    for (const { no, text } of readLines(file)) {
      if (/console\.log\s*\(/.test(text)) bad.push(`${rel(file)}:${no} 请移除 console.log`)
    }
  }
  return bad
})

check('SFC 样式必须 scoped', () => {
  const bad = []
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8')
    for (const tag of text.matchAll(/<style([^>]*)>/g)) {
      if (!/\bscoped\b/.test(tag[1])) bad.push(`${rel(file)} 存在未 scoped 的 <style> 块`)
    }
  }
  return bad
})

check('离线资源清单完整（sw-assets.json）', () => {
  const dist = join(ROOT, 'dist')
  if (!existsSync(dist)) return []
  if (!read('public/sw.js').includes('sw-assets.json')) return ['public/sw.js 未引用 sw-assets.json']

  const listPath = join(dist, 'sw-assets.json')
  if (!existsSync(listPath)) return ['缺少 dist/sw-assets.json（需在 vite.config.js 构建期生成）']
  const list = JSON.parse(readFileSync(listPath, 'utf8'))
  if (!Array.isArray(list)) return ['sw-assets.json 不是数组']

  const manifestPath = join(dist, '.vite', 'manifest.json')
  if (!existsSync(manifestPath)) return ['缺少 dist/.vite/manifest.json']
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const expected = new Set()
  for (const item of Object.values(manifest)) {
    if (item && typeof item.file === 'string' && /\.(js|css)$/.test(item.file)) expected.add(`./${item.file}`)
  }

  const bad = []
  for (const file of expected) if (!list.includes(file)) bad.push(`sw-assets.json 缺少 ${file}`)
  for (const file of list) {
    if (typeof file !== 'string' || !existsSync(join(dist, file.replace('./', '')))) {
      bad.push(`sw-assets.json 引用了不存在的文件：${file}`)
    }
  }
  return bad
})

check('产物体积预算（首屏 JS ≤ 52 kB / CSS ≤ 6.5 kB，gzip）', () => {
  const dir = join(ROOT, 'dist', 'assets')
  if (!existsSync(dir)) return [] // 未构建时跳过

  const bad = []

  // CSS 仍是单文件（cssCodeSplit: false）
  for (const name of readdirSync(dir).filter((f) => extname(f) === '.css')) {
    const gz = gzipSync(readFileSync(join(dir, name))).length
    const tag = `${name} gzip ${(gz / 1024).toFixed(2)} kB / 预算 ${(BUDGET.css / 1024).toFixed(2)} kB`
    if (gz > BUDGET.css) bad.push(`超预算：${tag}`)
    else console.log(`    ${tag}（余量 ${((BUDGET.css - gz) / 1024).toFixed(2)} kB）`)
  }

  // JS 只统计「入口 chunk + 静态依赖」：按需加载的弹窗 chunk 属于交互后资源，不计入首屏
  const manifestPath = join(ROOT, 'dist', '.vite', 'manifest.json')
  if (!existsSync(manifestPath)) {
    return [...bad, '缺少 dist/.vite/manifest.json（需在 vite.config.js 开启 build.manifest 后重新构建）']
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry)
  if (!entryKey) return [...bad, 'manifest 中未找到入口 chunk']

  const seen = new Set()
  const collect = (key) => {
    if (!key || seen.has(key) || !manifest[key]) return
    seen.add(key)
    for (const dep of manifest[key].imports || []) collect(dep)
  }
  collect(entryKey)

  let total = 0
  let jsFiles = 0
  for (const key of seen) {
    const file = manifest[key].file
    if (!file || extname(file) !== '.js') continue
    total += gzipSync(readFileSync(join(ROOT, 'dist', file))).length
    jsFiles += 1
  }

  const tag = `首屏 JS（${jsFiles} 个文件）gzip ${(total / 1024).toFixed(2)} kB / 预算 ${(BUDGET.js / 1024).toFixed(2)} kB`
  if (total > BUDGET.js) bad.push(`超预算：${tag}`)
  else console.log(`    ${tag}（余量 ${((BUDGET.js - total) / 1024).toFixed(2)} kB）`)

  return bad
})

console.log('\nNav-AI 工程约束自检\n' + '─'.repeat(46))
for (const { name, problems } of results) {
  if (problems.length) {
    console.log(`[fail] ${name}`)
    for (const p of problems) console.log(`       - ${p}`)
  } else {
    console.log(`[ ok ] ${name}`)
  }
}
const failed = results.filter((r) => r.problems.length)
console.log('─'.repeat(46))
console.log(`通过 ${results.length - failed.length} / ${results.length} 项`)
if (!existsSync(join(ROOT, 'dist', 'assets'))) {
  console.log('提示：未发现 dist 产物，体积检查已跳过（先执行 npm run build）')
}
process.exit(failed.length ? 1 : 0)
