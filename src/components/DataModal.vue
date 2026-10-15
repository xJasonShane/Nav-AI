<script setup>
import { ref, computed } from 'vue'
import Modal from './Modal.vue'
import ConfirmCard from './ConfirmCard.vue'
import { store, exportJSON, importJSON, resetData, importSites } from '../store/data.js'
import { parseBookmarksHTML } from '../utils/importers.js'
import { showToast } from '../utils/toast.js'

const emit = defineEmits(['close'])

const importText = ref('')
const message = ref('')
const messageType = ref('ok')
const fileInput = ref(null)
const bookmarksInput = ref(null)
const confirmingReset = ref(false)

const stats = computed(() => {
  let subs = 0
  store.categories.forEach((c) => (subs += (c.children || []).length))
  return { cats: store.categories.length, subs, sites: store.sites.length }
})

function notify(text, type = 'ok') {
  message.value = text
  messageType.value = type
  setTimeout(() => (message.value = ''), 3000)
}

function download() {
  const blob = new Blob([exportJSON()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `nav-ai-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  notify('备份文件已开始下载')
}

async function copyJSON() {
  try {
    await navigator.clipboard.writeText(exportJSON())
    notify('已复制到剪贴板')
  } catch {
    notify('复制失败，请使用导出文件功能', 'err')
  }
}

/** 导入并提示结果（含被归入「未分类」的站点数） */
function applyImport(text) {
  try {
    const result = importJSON(text)
    const extra = result.moved ? `；其中 ${result.moved} 个站点的分类已失效，已归入「未分类」` : ''
    notify(`导入成功：${result.categories} 个分类 / ${result.sites} 个站点${extra}`)
    return true
  } catch (e) {
    notify('导入失败：' + e.message, 'err')
    return false
  }
}

function doImportText() {
  if (applyImport(importText.value)) importText.value = ''
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => applyImport(String(reader.result))
  reader.readAsText(file)
  e.target.value = ''
}

/** 导入浏览器书签 HTML：按文件夹还原分类，与现有数据合并（同网址去重） */
function onBookmarksChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const entries = parseBookmarksHTML(String(reader.result))
    if (!entries.length) {
      notify('未解析出书签，请确认是浏览器导出的书签 HTML 文件', 'err')
      return
    }
    const result = importSites(entries)
    const parts = [`新增 ${result.added} 个站点`]
    if (result.categories) parts.push(`新建 ${result.categories} 个分类`)
    if (result.skipped) parts.push(`跳过 ${result.skipped} 个重复项`)
    notify('书签导入完成：' + parts.join('，'))
  }
  reader.readAsText(file)
  e.target.value = ''
}

function doReset() {
  resetData()
  confirmingReset.value = false
  notify('已恢复默认数据')
}
</script>

<template>
  <Modal title="数据管理" :width="480" @close="emit('close')">
    <div class="stats">
      <div class="stat"><b>{{ stats.cats }}</b><span>顶级分类</span></div>
      <div class="stat"><b>{{ stats.subs }}</b><span>子分类</span></div>
      <div class="stat"><b>{{ stats.sites }}</b><span>站点</span></div>
    </div>

    <p v-if="message" class="msg" :class="messageType" role="status" aria-live="polite">{{ message }}</p>

    <section class="sec">
      <h4>导出备份</h4>
      <p class="hint">将当前数据导出为 JSON 文件，可导入到其他设备恢复。</p>
      <div class="ops">
        <button class="btn btn-primary" type="button" @click="download">下载备份文件</button>
        <button class="btn btn-ghost" type="button" @click="copyJSON">复制到剪贴板</button>
      </div>
    </section>

    <section class="sec">
      <h4>导入数据</h4>
      <p class="hint">粘贴备份 JSON 内容，或选择本地备份文件（将覆盖当前数据）。</p>
      <textarea v-model="importText" class="field-input" rows="4" aria-label="粘贴备份 JSON" placeholder='{"version":1,"categories":[…],"sites":[…]}'></textarea>
      <div class="ops">
        <button class="btn btn-primary" type="button" :disabled="!importText.trim()" @click="doImportText">从文本导入</button>
        <button class="btn btn-ghost" type="button" @click="fileInput.click()">选择备份文件…</button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFileChange" />
      </div>
    </section>

    <section class="sec">
      <h4>导入浏览器书签</h4>
      <p class="hint">
        选择浏览器导出的书签 HTML（Chrome / Edge：书签管理器 → 导出书签），按文件夹还原为分类，并与现有数据合并（同网址自动跳过）。
      </p>
      <div class="ops">
        <button class="btn btn-ghost" type="button" @click="bookmarksInput.click()">选择书签文件…</button>
        <input ref="bookmarksInput" type="file" accept=".html,.htm,text/html" hidden @change="onBookmarksChange" />
      </div>
    </section>

    <section class="sec">
      <h4>恢复默认</h4>
      <p class="hint">清除当前数据，恢复为内置的演示数据。</p>
      <button v-if="!confirmingReset" class="btn btn-danger" type="button" @click="confirmingReset = true">恢复默认演示数据</button>
      <ConfirmCard
        v-else
        class="reset-confirm"
        confirm-text="确认恢复"
        danger
        @confirm="doReset"
        @cancel="confirmingReset = false"
      >
        确定恢复为默认演示数据？当前所有数据将被覆盖。
      </ConfirmCard>
    </section>
  </Modal>
</template>

<style scoped>
.stats {
  display: flex;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}

.stat {
  flex: 1;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp-3);
  text-align: center;
}

.stat b {
  display: block;
  font-size: var(--fs-xl);
  line-height: var(--lh-tight);
  font-variant-numeric: tabular-nums;
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.stat span {
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.msg {
  font-size: var(--fs-sm);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  margin-bottom: var(--sp-3);
}

.msg.ok {
  color: var(--ok-text);
  background: color-mix(in srgb, var(--ok) 10%, transparent);
}

.msg.err {
  color: var(--danger-text);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.sec {
  padding: var(--sp-3) 0;
  border-top: 1px solid var(--border);
}

.sec h4 {
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  margin-bottom: var(--sp-1);
}

.hint {
  margin-bottom: var(--sp-3);
}

.ops {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

textarea.field-input {
  margin-bottom: var(--sp-3);
}

.reset-confirm {
  margin-top: var(--sp-1);
}
</style>
