<script setup>
/**
 * 统一功能图标：线性描边 + currentColor，路径集中维护。
 * 规格：viewBox 24、stroke-linecap/linejoin=round、默认 14px / stroke 2（大尺寸图标可传 size/stroke）。
 * 说明：品牌标、主题/搜索/数据库等一次性的复合图标仍以内联 SVG 就近维护。
 */
import { computed } from 'vue'

const props = defineProps({
  /** 见下方 PATHS 的键名 */
  name: { type: String, required: true },
  size: { type: [Number, String], default: 14 },
  stroke: { type: [Number, String], default: 2 },
})

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
  close: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  warn: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 8v5m0 3.4h.01',
}

const d = computed(() => PATHS[props.name] || '')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="d" />
  </svg>
</template>
