<script setup>
import { reactive, computed } from 'vue'
import Modal from './Modal.vue'
import { addSite, updateSite, store } from '../store/data.js'

const props = defineProps({
  /** 编辑时传入站点对象，新建时传 null */
  site: { type: Object, default: null },
  /** 新建时的默认分类 */
  categoryId: { type: String, default: null },
})

const emit = defineEmits(['close'])

const isEdit = computed(() => !!props.site)

const form = reactive({
  name: props.site?.name || '',
  url: props.site?.url || '',
  desc: props.site?.desc || '',
  icon: props.site?.icon || '',
  categoryId: props.site ? props.site.categoryId : props.categoryId || '',
})

const error = reactive({ name: '', url: '' })

/** 树形分类选项（缩进展示） */
const options = computed(() => {
  const list = []
  for (const cat of store.categories) {
    list.push({ id: cat.id, label: `${cat.icon || '📁'} ${cat.name}`, depth: 0 })
    for (const child of cat.children || []) {
      list.push({ id: child.id, label: `${child.icon || '📂'} ${child.name}`, depth: 1 })
    }
  }
  return list
})

function submit() {
  error.name = form.name.trim() ? '' : '请输入站点名称'
  if (!form.url.trim()) error.url = '请输入站点网址'
  else error.url = ''

  let url = form.url.trim()
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url

  if (error.name || error.url) return

  const payload = {
    name: form.name.trim(),
    url,
    desc: form.desc.trim(),
    icon: form.icon.trim(),
    categoryId: form.categoryId || null,
  }

  if (isEdit.value) updateSite(props.site.id, payload)
  else addSite(payload)
  emit('close')
}
</script>

<template>
  <Modal :title="isEdit ? '编辑站点' : '添加站点'" :width="440" @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span class="label">名称 <i>*</i></span>
        <input v-model="form.name" type="text" placeholder="例如：GitHub" :class="{ invalid: error.name }" />
        <span v-if="error.name" class="err">{{ error.name }}</span>
      </label>

      <label class="field">
        <span class="label">网址 <i>*</i></span>
        <input v-model="form.url" type="text" inputmode="url" placeholder="https://example.com（可省略 https://）" :class="{ invalid: error.url }" />
        <span v-if="error.url" class="err">{{ error.url }}</span>
      </label>

      <label class="field">
        <span class="label">描述</span>
        <input v-model="form.desc" type="text" placeholder="一句话介绍该站点（可选）" maxlength="60" />
      </label>

      <label class="field">
        <span class="label">图标地址</span>
        <input v-model="form.icon" type="text" inputmode="url" placeholder="留空将自动获取站点图标" />
      </label>

      <label class="field">
        <span class="label">所属分类</span>
        <select v-model="form.categoryId">
          <option value="">未分类</option>
          <option v-for="opt in options" :key="opt.id" :value="opt.id">{{ '\u00A0'.repeat(opt.depth * 4) + opt.label }}</option>
        </select>
      </label>
    </form>

    <template #footer>
      <button class="btn btn-ghost" @click="emit('close')">取消</button>
      <button class="btn btn-primary" @click="submit">{{ isEdit ? '保存' : '添加' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

.label i {
  color: var(--danger);
  font-style: normal;
}

input,
select {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  outline: none;
  font-size: 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

input:focus,
select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}

input.invalid {
  border-color: var(--danger);
}

.err {
  font-size: 12px;
  color: var(--danger);
}
</style>
