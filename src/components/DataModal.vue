<script setup>
import { ref, computed, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
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
  readLocalSnapshot,
  restoreLocalSnapshot,
  normalizeData,
  migrate,
  DATA_VERSION,
  MAX_IMPORT_CHARS,
} from '../store/data.js'
import { parseBookmarksHTML, backupToEntries, previewMerge } from '../utils/importers.js'
import { buildSharePage } from '../utils/export-page.js'
import { buildBookmarksHTML } from '../utils/export-bookmarks.js'
import { showUndo } from '../utils/toast.js'
import { lastExportedAt, markExported } from '../utils/backup.js'

const emit = defineEmits(['close'])

/** 文件读取与数据层使用同一上限，挡住超大文件在主线程解析 */
const MAX_IMPORT_BYTES = MAX_IMPORT_CHARS

const importText = ref('')
const importMode = ref('overwrite') // overwrite = 覆盖导入，merge = 与现有数据合并
/** 已预览、等待确认的导入任务：{ text, mode, stats } */
const pendingImport = ref(null)
/** 已解析、等待确认的书签导入：{ entries, stats, name } */
const pendingBookmarks = ref(null)
const message = ref('')
const messageType = ref('ok')
const fileInput = ref(null)
const bookmarksInput = ref(null)
const confirmingReset = ref(false)
/** 覆盖式操作前自动保存的本地快照 */
const localSnapshot = ref(null)
const confirmingRestore = ref(false)
/** 备份健康度与存储用量（仅展示，不进入数据 schema） */
const storageInfo = ref({ last: null, usage: 0, quota: 0, persisted: null })

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

/** 读取备份时间与存储用量：浏览器不支持 Storage API 时保持占位，不影响导入导出 */
onMounted(async () => {
  storageInfo.value.last = lastExportedAt()
  localSnapshot.value = readLocalSnapshot()
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      storageInfo.value.usage = estimate.usage || 0
      storageInfo.value.quota = estimate.quota || 0
    }
    if (navigator.storage?.persisted) {
      storageInfo.value.persisted = await navigator.storage.persisted()
    }
  } catch (e) {
    /* 隐私模式 / 旧浏览器：忽略 */
  }
})

function formatBytes(bytes) {
  if (!bytes) return '—'
  const mb = bytes / 1024 / 1024
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatDate(timestamp) {
  if (!timestamp) return '尚未导出'
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 撤销 / 导入后把焦点留在对话框内，避免按钮消失后落回 body */
function focusDialog() {
  nextTick(() => document.querySelector('.modal-box')?.focus?.())
}

function refreshLocalSnapshot() {
  localSnapshot.value = readLocalSnapshot()
}

/** 恢复自动备份：先把当前数据放进内存快照，恢复后仍可 6 秒撤销 */
function restoreAutoSnapshot() {
  const at = localSnapshot.value?.at
  const current = captureSnapshot()
  if (!restoreLocalSnapshot()) {
    confirmingRestore.value = false
    notify('自动备份不可用或结构已损坏', 'err')
    return
  }
  confirmingRestore.value = false
  refreshLocalSnapshot()
  notify(`已恢复 ${formatDate(at)} 的自动备份`)
  focusDialog()
  showUndo('已恢复自动备份', () => {
    if (restoreSnapshot(current)) {
      notify('已回到恢复前的数据')
      focusDialog()
    }
  }, '撤销恢复')
}

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
  markExported()
  storageInfo.value.last = Date.now()
  notify('备份文件已开始下载')
}

async function copyJSON() {
  try {
    await navigator.clipboard.writeText(exportJSON())
    markExported()
    storageInfo.value.last = Date.now()
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
  // 同一时间只保留一种待确认导入，避免两个确认按钮并存
  pendingBookmarks.value = null
  if (text.length > MAX_IMPORT_CHARS) {
    notify(`导入内容过大（超过 ${Math.round(MAX_IMPORT_CHARS / 1024 / 1024)} MB），请拆分后再试`, 'err')
    return
  }
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
    refreshLocalSnapshot()
    focusDialog()
    showUndo('导入完成，可在 6 秒内撤销', () => {
      if (restoreSnapshot(snapshot)) {
        notify('已恢复导入前的数据')
        focusDialog()
      }
    }, '撤销导入')
  } catch (e) {
    notify('导入失败：' + e.message, 'err')
  }
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  pendingBookmarks.value = null
  if (file.size > MAX_IMPORT_BYTES) {
    notify(`文件过大（超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB），请拆分后再导入`, 'err')
    e.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onerror = () => notify('读取文件失败，请重试', 'err')
  reader.onload = () => previewJSON(String(reader.result))
  reader.readAsText(file)
  e.target.value = ''
}

/** 导入浏览器书签 HTML：先解析并预览，确认后才写入（与 JSON 导入共用快照/撤销） */
function onBookmarksChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  pendingImport.value = null
  if (file.size > MAX_IMPORT_BYTES) {
    notify(`文件过大（超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB），请拆分后再导入`, 'err')
    e.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onerror = () => notify('读取文件失败，请重试', 'err')
  reader.onload = () => {
    try {
      const entries = parseBookmarksHTML(String(reader.result))
      if (!entries.length) {
        notify('未解析出书签，请确认是浏览器导出的书签 HTML 文件', 'err')
        return
      }
      const stats = previewMerge(store.categories, store.sites, entries)
      pendingBookmarks.value = { entries, stats, name: file.name }
      notify(`书签预览：新增 ${stats.added} 个站点、跳过 ${stats.skipped} 个重复项、新建 ${stats.categories} 个分类`)
    } catch (e) {
      notify('书签解析失败：' + e.message, 'err')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

/** 确认书签导入：先留快照，写入后可整批撤销 */
function confirmBookmarks() {
  const job = pendingBookmarks.value
  pendingBookmarks.value = null
  if (!job) return

  const snapshot = captureSnapshot()
  try {
    const result = importSites(job.entries)
    const parts = [`新增 ${result.added} 个站点`]
    if (result.categories) parts.push(`新建 ${result.categories} 个分类`)
    if (result.skipped) parts.push(`跳过 ${result.skipped} 个重复项`)
    notify('书签导入完成：' + parts.join('，'))
    focusDialog()
    if (!result.added) return
    showUndo(`已导入 ${result.added} 个站点`, () => {
      if (restoreSnapshot(snapshot)) {
        notify('已撤销书签导入')
        focusDialog()
      }
    }, '撤销导入')
  } catch (e) {
    notify('书签导入失败：' + e.message, 'err')
  }
}

function doReset() {
  const snapshot = captureSnapshot()
  resetData()
  confirmingReset.value = false
  refreshLocalSnapshot()
  notify('已恢复默认数据')
  focusDialog()
  showUndo('已恢复默认数据', () => {
    if (restoreSnapshot(snapshot)) {
      notify('已恢复重置前的数据')
      focusDialog()
    }
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
      <p class="hint">
        上次完整备份：{{ formatDate(storageInfo.last) }}；本地占用约 {{ formatBytes(storageInfo.usage) }}<template v-if="storageInfo.quota"> / 可用约 {{ formatBytes(storageInfo.quota) }}</template>。
        <template v-if="storageInfo.persisted === true">浏览器已授予持久化存储。</template>
        <template v-else-if="storageInfo.persisted === false">浏览器未授予持久化存储，清理站点数据会丢失。</template>
      </p>
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

      <!-- 书签导入与 JSON 导入一致：先预览统计，确认后才写入 -->
      <div v-if="pendingBookmarks" class="preview">
        <p class="hint">
          将新增 {{ pendingBookmarks.stats.added }} 个站点、跳过 {{ pendingBookmarks.stats.skipped }} 个重复项、新建 {{ pendingBookmarks.stats.categories }} 个分类。
        </p>
        <div class="ops">
          <button class="btn btn-primary" type="button" @click="confirmBookmarks">确认导入书签</button>
          <button class="btn btn-ghost" type="button" @click="pendingBookmarks = null">取消</button>
        </div>
      </div>
    </section>

    <section class="sec">
      <h4>自动备份</h4>
      <p class="hint">覆盖导入或恢复默认前，会自动保留上一份数据（单槽，仅最近一次）。</p>
      <p v-if="localSnapshot" class="hint">最近一次：{{ formatDate(localSnapshot.at) }}</p>
      <p v-else class="hint">暂无自动备份。</p>
      <button v-if="localSnapshot && !confirmingRestore" class="btn btn-ghost" type="button" @click="confirmingRestore = true; confirmingReset = false">
        恢复这份自动备份
      </button>
      <ConfirmCard
        v-if="confirmingRestore"
        class="reset-confirm"
        confirm-text="确认恢复"
        danger
        @confirm="restoreAutoSnapshot"
        @cancel="confirmingRestore = false"
      >
        确定用 {{ formatDate(localSnapshot && localSnapshot.at) }} 的自动备份替换当前全部数据？恢复前的数据仍可在 6 秒内撤销。
      </ConfirmCard>
    </section>

    <section class="sec">
      <h4>恢复默认</h4>
      <p class="hint">清除当前数据，恢复为内置的演示数据。</p>
      <button v-if="!confirmingReset" class="btn btn-danger" type="button" @click="confirmingReset = true; confirmingRestore = false">恢复默认演示数据</button>
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
  background: var(--gradient-text);
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

/* 书签导入预览：与确认卡区分，保持中性底色 */
.preview {
  margin-top: var(--sp-3);
  padding: var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
</style>
