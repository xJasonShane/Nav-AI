<script setup>
import { reactive, ref } from 'vue'
import Modal from './Modal.vue'
import { store, addCategory, renameCategory, removeCategory, moveCategory } from '../store/data.js'

const emit = defineEmits(['close'])

/** 正在重命名的节点 id；null 正常模式 */
const renaming = ref(null)
const renameForm = reactive({ name: '', icon: '' })

/** 正在新增子分类的父节点 id */
const addingChildOf = ref(null)
const childForm = reactive({ name: '', icon: '' })

const topForm = reactive({ name: '', icon: '' })
const showTopForm = ref(false)

/** 待删除确认的节点 */
const pendingDelete = ref(null)
const deleteInfo = ref({ sites: 0, subs: 0 })

function countDescendants(node) {
  return (node.children || []).length
}

function startRename(node) {
  renaming.value = node.id
  renameForm.name = node.name
  renameForm.icon = node.icon || ''
  addingChildOf.value = null
  showTopForm.value = false
}

function saveRename(id) {
  if (renameForm.name.trim()) {
    renameCategory(id, renameForm.name.trim(), renameForm.icon.trim())
  }
  renaming.value = null
}

function openChildForm(parentId) {
  addingChildOf.value = parentId
  childForm.name = ''
  childForm.icon = ''
  renaming.value = null
}

function saveChild() {
  if (childForm.name.trim()) {
    addCategory(childForm.name.trim(), childForm.icon.trim(), addingChildOf.value)
  }
  addingChildOf.value = null
}

function saveTop() {
  if (topForm.name.trim()) {
    addCategory(topForm.name.trim(), topForm.icon.trim(), null)
  }
  topForm.name = ''
  topForm.icon = ''
  showTopForm.value = false
}

function askDelete(node) {
  const ids = new Set([node.id])
  const walk = (list) => list.forEach((n) => { ids.add(n.id); walk(n.children || []) })
  walk(node.children || [])
  deleteInfo.value = {
    sites: store.sites.filter((s) => ids.has(s.categoryId)).length,
    subs: countDescendants(node),
  }
  pendingDelete.value = node
}

function confirmDelete() {
  removeCategory(pendingDelete.value.id)
  pendingDelete.value = null
}

function move(node, dir, parentId) {
  // moveCategory 需要 id 在同级列表中的位置，直接复用数据层
  moveCategory(node.id, dir)
}
</script>

<template>
  <Modal title="分类管理" :width="560" @close="emit('close')">
    <div class="cats">
      <!-- 顶级分类列表 -->
      <div v-for="(cat, i) in store.categories" :key="cat.id" class="cat-group">
        <div class="cat-row">
          <template v-if="renaming === cat.id">
            <input v-model="renameForm.icon" class="icon-input" placeholder="图标" maxlength="2" />
            <input v-model="renameForm.name" class="name-input" placeholder="分类名称" @keyup.enter="saveRename(cat.id)" />
            <button class="op ok" title="保存" @click="saveRename(cat.id)">✓</button>
            <button class="op" title="取消" @click="renaming = null">✕</button>
          </template>
          <template v-else>
            <span class="cat-icon">{{ cat.icon || '📁' }}</span>
            <span class="cat-name">{{ cat.name }}</span>
            <span class="cat-count">{{ cat.children.length }} 个子分类</span>
            <span class="row-ops">
              <button class="op" title="上移" :disabled="i === 0" @click="move(cat, -1)">↑</button>
              <button class="op" title="下移" :disabled="i === store.categories.length - 1" @click="move(cat, 1)">↓</button>
              <button class="op" title="添加子分类" @click="openChildForm(cat.id)">＋</button>
              <button class="op" title="重命名" @click="startRename(cat)">✎</button>
              <button class="op danger" title="删除" @click="askDelete(cat)">🗑</button>
            </span>
          </template>
        </div>

        <!-- 子分类 -->
        <div v-if="cat.children.length || addingChildOf === cat.id" class="sub-list">
          <div v-for="(child, j) in cat.children" :key="child.id" class="cat-row sub">
            <template v-if="renaming === child.id">
              <input v-model="renameForm.icon" class="icon-input" placeholder="图标" maxlength="2" />
              <input v-model="renameForm.name" class="name-input" placeholder="子分类名称" @keyup.enter="saveRename(child.id)" />
              <button class="op ok" title="保存" @click="saveRename(child.id)">✓</button>
              <button class="op" title="取消" @click="renaming = null">✕</button>
            </template>
            <template v-else>
              <span class="cat-icon">{{ child.icon || '📂' }}</span>
              <span class="cat-name">{{ child.name }}</span>
              <span class="cat-count">{{ store.sites.filter((s) => s.categoryId === child.id).length }} 个站点</span>
              <span class="row-ops">
                <button class="op" title="上移" :disabled="j === 0" @click="move(child, -1)">↑</button>
                <button class="op" title="下移" :disabled="j === cat.children.length - 1" @click="move(child, 1)">↓</button>
                <button class="op" title="重命名" @click="startRename(child)">✎</button>
                <button class="op danger" title="删除" @click="askDelete(child)">🗑</button>
              </span>
            </template>
          </div>

          <!-- 添加子分类表单 -->
          <div v-if="addingChildOf === cat.id" class="cat-row sub">
            <input v-model="childForm.icon" class="icon-input" placeholder="图标" maxlength="2" />
            <input v-model="childForm.name" class="name-input" placeholder="子分类名称" @keyup.enter="saveChild" />
            <button class="op ok" title="确定" @click="saveChild">✓</button>
            <button class="op" title="取消" @click="addingChildOf = null">✕</button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <p v-if="!store.categories.length && !showTopForm" class="empty">暂无分类，点击下方按钮创建第一个分类</p>

      <!-- 添加顶级分类 -->
      <div v-if="showTopForm" class="cat-row">
        <input v-model="topForm.icon" class="icon-input" placeholder="图标" maxlength="2" />
        <input v-model="topForm.name" class="name-input" placeholder="分类名称" @keyup.enter="saveTop" />
        <button class="op ok" title="确定" @click="saveTop">✓</button>
        <button class="op" title="取消" @click="showTopForm = false">✕</button>
      </div>

      <button class="btn btn-ghost add-btn" @click="showTopForm = true; renaming = null; addingChildOf = null">
        ＋ 添加分类
      </button>
    </div>

    <!-- 删除确认 -->
    <div v-if="pendingDelete" class="confirm">
      <p>
        确定删除「{{ pendingDelete.icon }} {{ pendingDelete.name }}」？
        <template v-if="deleteInfo.subs">该分类包含 {{ deleteInfo.subs }} 个子分类，将一并删除。</template>
        <template v-if="deleteInfo.sites">其中 {{ deleteInfo.sites }} 个站点将移入「未分类」。</template>
      </p>
      <div class="confirm-ops">
        <button class="btn btn-ghost" @click="pendingDelete = null">取消</button>
        <button class="btn btn-danger-solid" @click="confirmDelete">确认删除</button>
      </div>
    </div>

    <template #footer>
      <span class="tip">提示：站点必须挂在某个分类下，删除分类后其站点会移入「未分类」</span>
    </template>
  </Modal>
</template>

<style scoped>
.cats {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 52vh;
  overflow-y: auto;
  padding-right: 4px;
}

.cat-group {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: var(--surface);
}

.cat-row.sub {
  padding-left: 30px;
  border-top: 1px dashed var(--border);
  background: var(--bg-soft);
}

.sub-list {
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.cat-icon {
  font-size: 16px;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.cat-name {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-size: 11.5px;
  color: var(--text-3);
  flex-shrink: 0;
}

.row-ops {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.cat-row:hover .row-ops,
.cat-row:focus-within .row-ops {
  opacity: 1;
}

.op {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

.op:hover {
  background: var(--surface-hover);
  color: var(--accent);
}

.op.danger:hover {
  color: var(--danger);
}

.op.ok:hover {
  color: var(--ok);
}

.op:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon-input {
  width: 52px;
  height: 30px;
  padding: 0 8px;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-soft);
  outline: none;
  font-size: 13px;
  flex-shrink: 0;
}

.name-input {
  flex: 1;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--bg-soft);
  outline: none;
  font-size: 13px;
  min-width: 0;
}

.add-btn {
  align-self: flex-start;
}

.empty {
  font-size: 13px;
  color: var(--text-3);
  text-align: center;
  padding: 12px 0;
}

.confirm {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  background: color-mix(in srgb, var(--danger) 6%, var(--surface));
  border-radius: var(--radius-sm);
}

.confirm p {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}

.confirm-ops {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.tip {
  font-size: 12px;
  color: var(--text-3);
}
</style>
