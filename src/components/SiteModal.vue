<script setup>
import { reactive, computed } from 'vue'
import Modal from './Modal.vue'
import { addSite, updateSite, store, findCategory } from '../store/data.js'

const props = defineProps({
  /** 编辑时传入站点对象，新建时传 null */
  site: { type: Object, default: null },
  /** 新建时的默认分类 */
  categoryId: { type: String, default: null },
})

const emit = defineEmits(['close'])

const isEdit = computed(() => !!props.site)

/** 分类可能已失效（分类被删除、导入的数据带悬空 categoryId）：回退为「未分类」，避免写入孤儿数据 */
function validCategoryId(id) {
  return id && findCategory(id) ? id : ''
}

const form = reactive({
  name: props.site?.name || '',
  url: props.site?.url || '',
  desc: props.site?.desc || '',
  icon: props.site?.icon || '',
  categoryId: validCategoryId(props.site ? props.site.categoryId : props.categoryId),
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
        <span class="label">名称 <i aria-hidden="true">*</i></span>
        <input
          v-model="form.name"
          class="field-input"
          type="text"
          placeholder="例如：GitHub"
          :class="{ invalid: error.name }"
          :aria-invalid="error.name ? 'true' : undefined"
          :aria-describedby="error.name ? 'site-name-err' : undefined"
          data-autofocus
        />
        <span v-if="error.name" id="site-name-err" class="err">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5m0 3.4h.01" />
          </svg>
          {{ error.name }}
        </span>
      </label>

      <label class="field">
        <span class="label">网址 <i aria-hidden="true">*</i></span>
        <input
          v-model="form.url"
          class="field-input"
          type="text"
          inputmode="url"
          placeholder="https://example.com（可省略 https://）"
          :class="{ invalid: error.url }"
          :aria-invalid="error.url ? 'true' : undefined"
          :aria-describedby="error.url ? 'site-url-err' : undefined"
        />
        <span v-if="error.url" id="site-url-err" class="err">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5m0 3.4h.01" />
          </svg>
          {{ error.url }}
        </span>
      </label>

      <label class="field">
        <span class="label">描述</span>
        <input v-model="form.desc" class="field-input" type="text" placeholder="一句话介绍该站点（可选）" maxlength="60" />
      </label>

      <label class="field">
        <span class="label">图标地址</span>
        <input v-model="form.icon" class="field-input" type="text" inputmode="url" placeholder="留空将自动获取站点图标" />
      </label>

      <label class="field">
        <span class="label">所属分类</span>
        <select v-model="form.categoryId" class="field-input">
          <option value="">未分类</option>
          <option v-for="opt in options" :key="opt.id" :value="opt.id">{{ (opt.depth ? '　' : '') + opt.label }}</option>
        </select>
      </label>
    </form>

    <template #footer>
      <button class="btn btn-ghost" type="button" @click="emit('close')">取消</button>
      <button class="btn btn-primary" type="button" @click="submit">{{ isEdit ? '保存' : '添加' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.label {
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--text-2);
}

.label i {
  color: var(--danger-text);
  font-style: normal;
}

.err {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--danger-text);
  line-height: var(--lh-tight);
}

.err svg {
  flex-shrink: 0;
}
</style>
