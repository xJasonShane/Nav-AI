<script setup>
/**
 * 设置面板：站点标题 / 主题 / 主色 / 站点图标来源。
 * 全部即时生效（主题、主色、图标源写入数据层后由 watcher 应用到 DOM 与卡片），
 * 因此没有「取消」语义，底部只保留「完成」。
 */
import Modal from './Modal.vue'
import { store, ACCENT_PRESETS, DENSITIES } from '../store/data.js'

const emit = defineEmits(['close'])

const THEMES = [
  { key: 'auto', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
]

const ICON_SOURCES = [
  { key: 'auto', label: '直连优先', hint: '先取站点自身 /favicon.ico，失败再走图标服务' },
  { key: 'service', label: '服务优先', hint: '先走 favicon.im，命中率更高，但域名会暴露给第三方' },
]

function onTitleInput(e) {
  store.settings.title = e.target.value
}

/** 失焦时兜底：标题为空则回落到默认名，避免顶栏出现空白品牌 */
function normalizeTitle() {
  if (!store.settings.title.trim()) store.settings.title = 'Nav-AI'
}
</script>

<template>
  <Modal title="设置" :width="480" @close="emit('close')">
    <div class="form">
      <label class="field">
        <span class="label">站点标题</span>
        <input
          class="field-input"
          type="text"
          maxlength="24"
          placeholder="Nav-AI"
          :value="store.settings.title"
          data-autofocus
          @input="onTitleInput"
          @blur="normalizeTitle"
        />
        <span class="hint">显示在顶栏左侧，最多 24 个字符。</span>
      </label>

      <div class="field">
        <span class="label">主题</span>
        <div class="seg" role="radiogroup" aria-label="主题">
          <button
            v-for="t in THEMES"
            :key="t.key"
            class="seg-btn"
            type="button"
            role="radio"
            :aria-checked="store.settings.theme === t.key"
            :class="{ active: store.settings.theme === t.key }"
            @click="store.settings.theme = t.key"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">主色</span>
        <div class="swatches" role="radiogroup" aria-label="主色">
          <button
            v-for="p in ACCENT_PRESETS"
            :key="p.key"
            class="swatch"
            type="button"
            role="radio"
            :aria-checked="store.settings.accent === p.key"
            :class="{ active: store.settings.accent === p.key }"
            :style="{ background: p.color }"
            :title="p.label"
            :aria-label="p.label"
            @click="store.settings.accent = p.key"
          ></button>
        </div>
        <span class="hint">主色会同步影响按钮、激活态、焦点环与氛围光。</span>
      </div>

      <div class="field">
        <span class="label">卡片密度</span>
        <div class="seg" role="radiogroup" aria-label="卡片密度">
          <button
            v-for="d in DENSITIES"
            :key="d.key"
            class="seg-btn"
            type="button"
            role="radio"
            :aria-checked="store.settings.density === d.key"
            :class="{ active: store.settings.density === d.key }"
            @click="store.settings.density = d.key"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">卡片描述</span>
        <div class="seg" role="radiogroup" aria-label="卡片描述">
          <button
            class="seg-btn"
            type="button"
            role="radio"
            :aria-checked="store.settings.showDesc"
            :class="{ active: store.settings.showDesc }"
            @click="store.settings.showDesc = true"
          >
            显示
          </button>
          <button
            class="seg-btn"
            type="button"
            role="radio"
            :aria-checked="!store.settings.showDesc"
            :class="{ active: !store.settings.showDesc }"
            @click="store.settings.showDesc = false"
          >
            隐藏
          </button>
        </div>
        <span class="hint">隐藏描述后卡片只保留名称与图标，适合站点很多的场景。</span>
      </div>

      <div class="field">
        <span class="label">站点图标来源</span>
        <div class="seg" role="radiogroup" aria-label="站点图标来源">
          <button
            v-for="s in ICON_SOURCES"
            :key="s.key"
            class="seg-btn"
            type="button"
            role="radio"
            :aria-checked="store.settings.iconSource === s.key"
            :class="{ active: store.settings.iconSource === s.key }"
            @click="store.settings.iconSource = s.key"
          >
            {{ s.label }}
          </button>
        </div>
        <span class="hint">
          {{ ICON_SOURCES.find((s) => s.key === store.settings.iconSource)?.hint }}
        </span>
      </div>
    </div>

    <template #footer>
      <button class="btn btn-primary" type="button" @click="emit('close')">完成</button>
    </template>
  </Modal>
</template>

<style scoped>
.swatches {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.swatch {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  transition: box-shadow var(--dur-1), border-color var(--dur-1);
}

.swatch:hover {
  border-color: var(--border-strong);
}

.swatch.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-ring);
}
</style>
