<script setup>
import { ref, computed } from 'vue'
import Modal from './Modal.vue'
import { store, exportJSON, importJSON, resetData } from '../store/data.js'

const emit = defineEmits(['close'])

const importText = ref('')
const message = ref('')
const messageType = ref('ok')
const fileInput = ref(null)

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

function doImportText() {
  try {
    importJSON(importText.value)
    importText.value = ''
    notify('导入成功')
  } catch (e) {
    notify('导入失败：' + e.message, 'err')
  }
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      importJSON(String(reader.result))
      notify('导入成功')
    } catch (err) {
      notify('导入失败：' + err.message, 'err')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function doReset() {
  if (confirm('确定恢复为默认演示数据？当前所有数据将被覆盖。')) {
    resetData()
    notify('已恢复默认数据')
  }
}
</script>

<template>
  <Modal title="数据管理" :width="480" @close="emit('close')">
    <div class="stats">
      <div class="stat"><b>{{ stats.cats }}</b><span>顶级分类</span></div>
      <div class="stat"><b>{{ stats.subs }}</b><span>子分类</span></div>
      <div class="stat"><b>{{ stats.sites }}</b><span>站点</span></div>
    </div>

    <p v-if="message" class="msg" :class="messageType">{{ message }}</p>

    <section class="sec">
      <h4>导出备份</h4>
      <p class="hint">将当前数据导出为 JSON 文件，可导入到其他设备恢复。</p>
      <div class="ops">
        <button class="btn btn-primary" @click="download">下载备份文件</button>
        <button class="btn btn-ghost" @click="copyJSON">复制到剪贴板</button>
      </div>
    </section>

    <section class="sec">
      <h4>导入数据</h4>
      <p class="hint">粘贴备份 JSON 内容，或选择本地备份文件（将覆盖当前数据）。</p>
      <textarea v-model="importText" rows="4" placeholder='{"version":1,"categories":[…],"sites":[…]}'></textarea>
      <div class="ops">
        <button class="btn btn-primary" :disabled="!importText.trim()" @click="doImportText">从文本导入</button>
        <button class="btn btn-ghost" @click="fileInput.click()">选择备份文件…</button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFileChange" />
      </div>
    </section>

    <section class="sec">
      <h4>恢复默认</h4>
      <p class="hint">清除当前数据，恢复为内置的演示数据。</p>
      <button class="btn btn-danger" @click="doReset">恢复默认演示数据</button>
    </section>
  </Modal>
</template>

<style scoped>
.stats {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.stat {
  flex: 1;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  text-align: center;
}

.stat b {
  display: block;
  font-size: 20px;
  background: var(--gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.stat span {
  font-size: 12px;
  color: var(--text-3);
}

.msg {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.msg.ok {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 10%, transparent);
}

.msg.err {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.sec {
  padding: 14px 0;
  border-top: 1px solid var(--border);
}

.sec h4 {
  font-size: 14px;
  margin-bottom: 4px;
}

.hint {
  font-size: 12.5px;
  color: var(--text-3);
  margin-bottom: 10px;
}

.ops {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  padding: 10px 12px;
  font-size: 12.5px;
  font-family: Consolas, monospace;
  resize: vertical;
  outline: none;
  margin-bottom: 10px;
}

textarea:focus {
  border-color: var(--accent);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
