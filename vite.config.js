import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 构建后生成 SW 预缓存清单（dist/sw-assets.json）：
 * 只解析 HTML 拿不到按需弹窗的 chunk，首次断网打开「添加/设置/数据管理」会失败；
 * 这里把 manifest 里的全部 JS/CSS 列出来，交给 sw.js 在 install 阶段一并缓存。
 */
function swAssetsPlugin() {
  return {
    name: 'nav-ai-sw-assets',
    apply: 'build',
    closeBundle() {
      try {
        const root = process.cwd()
        const manifest = JSON.parse(readFileSync(join(root, 'dist', '.vite', 'manifest.json'), 'utf8'))
        const files = new Set()
        for (const item of Object.values(manifest)) {
          if (item && typeof item.file === 'string' && /\.(js|css)$/.test(item.file)) files.add(item.file)
        }
        writeFileSync(
          join(root, 'dist', 'sw-assets.json'),
          JSON.stringify([...files].sort().map((file) => `./${file}`))
        )
      } catch (e) {
        this.warn?.(`生成 sw-assets.json 失败：${e.message}`)
      }
    },
  }
}

export default defineConfig({
  // 子路径部署（如 GitHub Pages 项目页 /repo/）时设置 VITE_BASE=/repo/；
  // 根路径部署（Cloudflare Pages / EdgeOne）保持默认即可
  base: process.env.VITE_BASE || '/',
  plugins: [vue(), swAssetsPlugin()],
  define: {
    // 全站使用 <script setup>，无 Options API；关闭两项特性开关以剔除运行时冗余代码
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false
  },
  build: {
    target: 'es2018',
    cssCodeSplit: false,
    // 供 scripts/check.mjs 计算「入口 + 静态依赖」的首屏体积（按需 chunk 不计入）
    manifest: true
  }
})
