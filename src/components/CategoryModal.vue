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
            <input v-model="renameForm.icon" class="field-input icon-input" type="text" placeholder="图标" aria-label="分类图标" maxlength="2" />
            <input v-model="renameForm.name" class="field-input name-input" type="text" placeholder="分类名称" aria-label="分类名称" @keyup.enter="saveRename(cat.id)" />
            <button class="icon-btn-sm op ok" type="button" title="保存" aria-label="保存" @click="saveRename(cat.id)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
            <button class="icon-btn-sm op" type="button" title="取消" aria-label="取消" @click="renaming = null">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </template>
          <template v-else>
            <span class="cat-icon" aria-hidden="true">{{ cat.icon || '📁' }}</span>
            <span class="cat-name">{{ cat.name }}</span>
            <span class="cat-count">{{ cat.children.length }} 个子分类</span>
            <span class="row-ops">
              <button class="icon-btn-sm op" type="button" title="上移" aria-label="上移" :disabled="i === 0" @click="move(cat, -1)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
              <button class="icon-btn-sm op" type="button" title="下移" aria-label="下移" :disabled="i === store.categories.length - 1" @click="move(cat, 1)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </button>
              <button class="icon-btn-sm op" type="button" title="添加子分类" aria-label="添加子分类" @click="openChildForm(cat.id)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button class="icon-btn-sm op" type="button" title="重命名" aria-label="重命名" @click="startRename(cat)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
              <button class="icon-btn-sm op danger" type="button" title="删除" aria-label="删除" @click="askDelete(cat)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
              </button>
            </span>
          </template>
        </div>

        <!-- 子分类 -->
        <div v-if="cat.children.length || addingChildOf === cat.id" class="sub-list">
          <div v-for="(child, j) in cat.children" :key="child.id" class="cat-row sub">
            <template v-if="renaming === child.id">
              <input v-model="renameForm.icon" class="field-input icon-input" type="text" placeholder="图标" aria-label="子分类图标" maxlength="2" />
              <input v-model="renameForm.name" class="field-input name-input" type="text" placeholder="子分类名称" aria-label="子分类名称" @keyup.enter="saveRename(child.id)" />
              <button class="icon-btn-sm op ok" type="button" title="保存" aria-label="保存" @click="saveRename(child.id)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </button>
              <button class="icon-btn-sm op" type="button" title="取消" aria-label="取消" @click="renaming = null">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </template>
            <template v-else>
              <span class="cat-icon" aria-hidden="true">{{ child.icon || '📂' }}</span>
              <span class="cat-name">{{ child.name }}</span>
              <span class="cat-count">{{ store.sites.filter((s) => s.categoryId === child.id).length }} 个站点</span>
              <span class="row-ops">
                <button class="icon-btn-sm op" type="button" title="上移" aria-label="上移" :disabled="j === 0" @click="move(child, -1)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
                <button class="icon-btn-sm op" type="button" title="下移" aria-label="下移" :disabled="j === cat.children.length - 1" @click="move(child, 1)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                </button>
                <button class="icon-btn-sm op" type="button" title="重命名" aria-label="重命名" @click="startRename(child)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button class="icon-btn-sm op danger" type="button" title="删除" aria-label="删除" @click="askDelete(child)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </span>
            </template>
          </div>

          <!-- 添加子分类表单 -->
          <div v-if="addingChildOf === cat.id" class="cat-row sub">
            <input v-model="childForm.icon" class="field-input icon-input" type="text" placeholder="图标" aria-label="子分类图标" maxlength="2" data-autofocus />
            <input v-model="childForm.name" class="field-input name-input" type="text" placeholder="子分类名称" aria-label="子分类名称" @keyup.enter="saveChild" />
            <button class="icon-btn-sm op ok" type="button" title="确定" aria-label="确定" @click="saveChild">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
            <button class="icon-btn-sm op" type="button" title="取消" aria-label="取消" @click="addingChildOf = null">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <p v-if="!store.categories.length && !showTopForm" class="empty">暂无分类，点击下方按钮创建第一个分类</p>

      <!-- 添加顶级分类 -->
      <div v-if="showTopForm" class="cat-row">
        <input v-model="topForm.icon" class="field-input icon-input" type="text" placeholder="图标" aria-label="分类图标" maxlength="2" />
        <input v-model="topForm.name" class="field-input name-input" type="text" placeholder="分类名称" aria-label="分类名称" @keyup.enter="saveTop" />
        <button class="icon-btn-sm op ok" type="button" title="确定" aria-label="确定" @click="saveTop">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
        <button class="icon-btn-sm op" type="button" title="取消" aria-label="取消" @click="showTopForm = false">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <button class="btn-dashed add-btn" type="button" @click="showTopForm = true; renaming = null; addingChildOf = null">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        添加分类
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
        <button class="btn btn-ghost" type="button" @click="pendingDelete = null">取消</button>
        <button class="btn btn-danger-solid" type="button" @click="confirmDelete">确认删除</button>
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
  gap: var(--sp-3);
}

.cat-group {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 44px;
  padding: var(--sp-2) var(--sp-3);
  background: var(--surface);
}

.cat-row.sub {
  padding-left: var(--sp-8);
  border-top: 1px dashed var(--border);
  background: var(--bg-soft);
}

.sub-list {
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.cat-icon {
  font-size: var(--fs-lg);
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.cat-name {
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-size: var(--fs-xs);
  color: var(--text-3);
  flex-shrink: 0;
}

.row-ops {
  display: flex;
  gap: var(--sp-1);
  flex-shrink: 0;
}

.op:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 桌面端悬停/聚焦显现；触摸设备常显 */
@media (hover: hover) {
  .row-ops {
    opacity: 0;
    transition: opacity var(--dur-1);
  }

  .cat-row:hover .row-ops,
  .cat-row:focus-within .row-ops {
    opacity: 1;
  }
}

.icon-input {
  width: 52px;
  flex-shrink: 0;
  text-align: center;
  height: var(--control-h-sm);
  padding: 0 var(--sp-2);
  font-size: var(--fs-sm);
}

.name-input {
  flex: 1;
  width: auto;
  min-width: 0;
  height: var(--control-h-sm);
  font-size: var(--fs-sm);
}

.add-btn {
  align-self: flex-start;
}

.empty {
  font-size: var(--fs-sm);
  color: var(--text-2);
  text-align: center;
  padding: var(--sp-3) 0;
}

.confirm {
  margin-top: var(--sp-4);
  padding: var(--sp-4);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  background: color-mix(in srgb, var(--danger) 6%, var(--surface));
  border-radius: var(--radius-sm);
}

.confirm p {
  font-size: var(--fs-sm);
  color: var(--text-2);
  line-height: var(--lh-relaxed);
}

.confirm-ops {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}

.tip {
  font-size: var(--fs-xs);
  color: var(--text-3);
}
</style>
