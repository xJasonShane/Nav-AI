import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 子路径部署（如 GitHub Pages 项目页 /repo/）时设置 VITE_BASE=/repo/；
  // 根路径部署（Cloudflare Pages / EdgeOne）保持默认即可
  base: process.env.VITE_BASE || '/',
  plugins: [vue()],
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
