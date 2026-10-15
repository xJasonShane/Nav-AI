import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  define: {
    // 全站使用 <script setup>，无 Options API；关闭两项特性开关以剔除运行时冗余代码
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false
  },
  build: {
    target: 'es2018',
    cssCodeSplit: false
  }
})
