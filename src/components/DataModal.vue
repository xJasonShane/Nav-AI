<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import Modal from './Modal.vue'
import ConfirmCard from './ConfirmCard.vue'
import {
  store,
  exportJSON,
  importJSON,
  resetData,
  importSites,
  captureSnapshot,
  restoreSnapshot,
  normalizeData,
  migrate,
  DATA_VERSION,
} from '../store/data.js'
import { parseBookmarksHTML, backupToEntries, previewMerge } from '../utils/importers.js'
import { buildSharePage } from '../utils/export-page.js'
import { buildBookmarksHTML } from '../utils/export-bookmarks.js'
import { showToast } from '../utils/toast.js'

const emit = defineEmits(['close'])

const importText = ref('')
const importMode = ref('overwrite') // overwrite = 覆盖导入，merge = 与现有数据合并
/** 已预览、等待确认的导入任务：{ text, mode, stats } */
const pendingImport = ref(null)
const message = ref('')
const messageType = ref('ok')
const fileInput = ref(null)
const bookmarksInput = ref(null)
const confirmingReset = ref(false)

// 文本或模式变化后，旧预览立即失效，避免「看到 A 的统计却导入了 B」
watch([importText, importMode], () => {
  pendingImport.value = null
})

const stats = computed(() => {
  let subs = 0
  store.categories.forEach((c) => (subs += (c.children || []).length))
  return { cats: store.categories.length, subs, sites: store.sites.length }
})

/** 面板内结果提示：同一时间只保留最新一条（旧定时器必须清掉，否则会提前抹掉新消息） */
let messageTimer = 0

function notify(text, type = 'ok') {
  message.value = text
  messageType.value = type
  clearTimeout(messageTimer)
  messageTimer = setTimeout(() => (message.value = ''), 3000)
}

onBeforeUnmount(() => clearTimeout(messageTimer))

/** 统一下载：延迟释放 Blob URL，避免 Safari / 部分 WebView 在 click() 后立即 revoke 导致下载被取消 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function download() {
  triggerDownload(
    new Blob([exportJSON()], { type: 'application/json' }),
    `nav-ai-backup-${new Date().toISOString().slice(0, 10)}.json`
  )
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

/** 导出只读分享页：自包含 HTML，零外部请求，可直接发给他人 */
function downloadSharePage() {
  const html = buildSharePage({
    title: store.settings.title,
    categories: store.categories,
    sites: store.sites,
  })
  triggerDownload(
    new Blob([html], { type: 'text/html' }),
    `nav-ai-share-${new Date().toISOString().slice(0, 10)}.html`
  )
  notify('分享页已开始下载，可直接转发')
}

/** 导出浏览器书签 HTML：可与其它浏览器/工具互通 */
function downloadBookmarks() {
  const html = buildBookmarksHTML({ categories: store.categories, sites: store.sites })
  triggerDownload(
    new Blob([html], { type: 'text/html' }),
    `nav-ai-bookmarks-${new Date().toISOString().slice(0, 10)}.html`
  )
  notify('书签文件已开始下载，可导入浏览器')
}

/**
 * 第一步：预览导入结果（不修改任何数据）。
 * 覆盖模式用 normalizeData 预演真实导入；合并模式复用 importSites 的去重/建分类规则。
 */
function previewJSON(text) {
  try {
    const parsed = JSON.parse(text)
    if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.sites)) {
      notify('数据格式不正确：缺少 categories 或 sites 字段', 'err')
      return
    }
    const declared = Number.isInteger(parsed.version) ? parsed.version : 1
    if (declared > DATA_VERSION) {
      notify(`数据版本 v${declared} 高于当前应用支持的 v${DATA_VERSION}，请升级应用后再导入`, 'err')
      return
    }

    if (importMode.value === 'merge') {
      const stats = previewMerge(store.categories, store.sites, backupToEntries(parsed))
      pendingImport.value = { text, mode: 'merge', stats }
      notify(
        `合并预览：预计新增 ${stats.added} 个站点、跳过 ${stats.skipped} 个重复项、新建 ${stats.categories} 个分类`
      )
    } else {
      const clean = normalizeData(migrate(parsed))
      pendingImport.value = {
        text,
        mode: 'overwrite',
        stats: { sites: clean.sites.length, categories: clean.categories.length, moved: clean.moved },
      }
      const moved = clean.moved ? `；${clean.moved} 个站点分类失效，将归入「未分类」` : ''
      notify(`覆盖预览：将导入 ${clean.categories.length} 个分类 / ${clean.sites.length} 个站点${moved}`)
    }
  } catch (e) {
    notify('解析失败：' + e.message, 'err')
  }
}

/** 第二步：确认执行，执行前留快照以便撤销 */
function confirmImport() {
  const job = pendingImport.value
  pendingImport.value = null
  if (!job) return

  const snapshot = captureSnapshot()
  try {
    if (job.mode === 'merge') {
      const result = importSites(backupToEntries(JSON.parse(job.text)))
      const extra = result.skipped ? `，跳过 ${result.skipped} 个重复项` : ''
      const cats = result.categories ? `，新建 ${result.categories} 个分类` : ''
      notify(`合并完成：新增 ${result.added} 个站点${extra}${cats}`)
    } else {
      const result = importJSON(job.text)
      const extra = result.moved ? `；其中 ${result.moved} 个站点的分类已失效，已归入「未分类」` : ''
      notify(`导入成功：${result.categories} 个分类 / ${result.sites} 个站点${extra}`)
    }
    importText.value = ''
    showToast('导入完成，可在 6 秒内撤销', {
      label: '撤销导入',
      run: () => {
        if (restoreSnapshot(snapshot)) notify('已恢复导入前的数据')
      },
    })
  } catch (e) {
    notify('导入失败：' + e.message, 'err')
  }
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => previewJSON(String(reader.result))
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
  const snapshot = captureSnapshot()
  resetData()
  confirmingReset.value = false
  notify('已恢复默认数据')
  showToast('已恢复默认数据', {
    label: '撤销',
    run: () => {
      if (restoreSnapshot(snapshot)) notify('已恢复重置前的数据')
    },
  })
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
        <button class="btn btn-ghost" type="button" @click="downloadSharePage">导出只读分享页</button>
        <button class="btn btn-ghost" type="button" @click="downloadBookmarks">导出浏览器书签</button>
      </div>
      <p class="hint">「只读分享页」是一份自包含的 HTML（数据与样式全部内联、不请求任何外部资源），适合直接发给他人或离线查看；「浏览器书签」可导入 Chrome / Edge / Firefox 等。</p>
    </section>

    <section class="sec">
      <h4>导入数据</h4>
      <p class="hint">覆盖导入会替换当前全部数据（可撤销）；合并导入按网址去重，并与现有分类按名称合并。</p>
      <div class="seg" role="radiogroup" aria-label="导入方式">
        <button class="seg-btn" type="button" role="radio" :aria-checked="importMode === 'overwrite'" :class="{ active: importMode === 'overwrite' }" @click="importMode = 'overwrite'">
          覆盖导入
        </button>
        <button class="seg-btn" type="button" role="radio" :aria-checked="importMode === 'merge'" :class="{ active: importMode === 'merge' }" @click="importMode = 'merge'">
          合并导入
        </button>
      </div>
      <textarea v-model="importText" class="field-input" rows="4" aria-label="粘贴备份 JSON" placeholder='{"categories":[…],"sites":[…]}'></textarea>
      <div class="ops">
        <button class="btn btn-primary" type="button" :disabled="!importText.trim()" @click="previewJSON(importText)">预览导入</button>
        <button v-if="pendingImport" class="btn" :class="pendingImport.mode === 'merge' ? 'btn-primary' : 'btn-danger-solid'" type="button" @click="confirmImport">确认导入</button>
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

/* 导入方式分段控件与下方文本框的间距（全局 .seg 不带外边距） */
.sec .seg {
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
