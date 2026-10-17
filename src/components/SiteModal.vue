<script setup>
import { reactive, computed, ref } from 'vue'
import Modal from './Modal.vue'
import Icon from './Icon.vue'
import { addSite, updateSite, store, findCategory, importSites } from '../store/data.js'
import { parseSiteLines } from '../utils/importers.js'
import { isValidHttpUrl } from '../utils/url.js'
import { flattenCategories } from '../utils/grouping.js'
import { showToast } from '../utils/toast.js'

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
  tags: (props.site?.tags || []).join(', '),
  pinned: props.site?.pinned === true,
})

const error = reactive({ name: '', url: '' })

/** 新建时可切换「单个 / 批量」：批量模式粘贴多行文本，按 URL 去重后一次性建条目 */
const bulk = ref(false)
const bulkText = ref('')
const bulkError = ref('')

/** 树形分类选项（缩进展示） */
const options = computed(() =>
  flattenCategories(store.categories).map((opt) => ({
    id: opt.id,
    depth: opt.depth,
    label: `${opt.icon || (opt.depth ? '📂' : '📁')} ${opt.name}`,
  }))
)

function submit() {
  const name = form.name.trim()
  const raw = form.url.trim()
  const url = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw

  error.name = name ? '' : '请输入站点名称'
  if (!url) error.url = '请输入站点网址'
  else if (!isValidHttpUrl(url)) error.url = '请输入有效的网址（如 https://example.com）'
  else error.url = ''

  if (error.name || error.url) return

  const payload = {
    name,
    url,
    desc: form.desc.trim(),
    icon: form.icon.trim(),
    categoryId: form.categoryId || null,
    pinned: form.pinned,
    tags: [...new Set(form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 8),
  }

  if (isEdit.value) updateSite(props.site.id, payload)
  else addSite(payload)
  emit('close')
}

/** 批量添加：解析文本 → 去重导入 → 关闭（结果由全局提示反馈） */
function submitBulk() {
  const entries = parseSiteLines(bulkText.value)
  if (!entries.length) {
    bulkError.value = '没有识别到有效网址，请检查每行格式'
    return
  }
  const result = importSites(entries, form.categoryId || null)
  emit('close')
  const parts = [`已添加 ${result.added} 个站点`]
  if (result.skipped) parts.push(`跳过 ${result.skipped} 个重复项`)
  showToast(parts.join('，'))
}
</script>

<template>
  <Modal :title="isEdit ? '编辑站点' : bulk ? '批量添加站点' : '添加站点'" :width="bulk ? 520 : 440" @close="emit('close')">
    <div class="form">
      <div v-if="!isEdit" class="seg" role="tablist" aria-label="添加方式">
        <button class="seg-btn" type="button" role="tab" :aria-selected="!bulk" :class="{ active: !bulk }" @click="bulk = false">
          单个添加
        </button>
        <button class="seg-btn" type="button" role="tab" :aria-selected="bulk" :class="{ active: bulk }" @click="bulk = true">
          批量添加
        </button>
      </div>

      <!-- 分类选择：两种模式共用（批量模式作为统一目标分类） -->
      <label class="field">
        <span class="label">所属分类</span>
        <select v-model="form.categoryId" class="field-input">
          <option value="">未分类</option>
          <option v-for="opt in options" :key="opt.id" :value="opt.id">{{ (opt.depth ? '　' : '') + opt.label }}</option>
        </select>
      </label>

      <template v-if="bulk">
        <label class="field">
          <span class="label">站点列表</span>
          <textarea
            v-model="bulkText"
            class="field-input"
            rows="7"
            aria-label="批量站点列表"
            placeholder="每行一个站点，支持三种写法：&#10;https://github.com&#10;GitHub https://github.com&#10;掘金|https://juejin.cn"
            data-autofocus
            @input="bulkError = ''"
          ></textarea>
          <span v-if="bulkError" class="err" role="alert">{{ bulkError }}</span>
          <span v-else class="hint">名称可省略（默认用域名）；网址重复的条目会自动跳过，方便反复粘贴整份清单。</span>
        </label>
      </template>

      <template v-else>
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
            @input="error.name = ''"
          />
          <span v-if="error.name" id="site-name-err" class="err">
            <Icon name="warn" :size="12" />
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
            @input="error.url = ''"
          />
          <span v-if="error.url" id="site-url-err" class="err">
            <Icon name="warn" :size="12" />
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
          <span class="label">标签</span>
          <input v-model="form.tags" class="field-input" type="text" placeholder="用逗号分隔，例如：AI, 工具" maxlength="80" />
          <span class="hint">标签会参与搜索，并显示在卡片描述下方。</span>
        </label>

        <div class="field">
          <span class="label">置顶</span>
          <div class="seg" role="radiogroup" aria-label="是否置顶">
            <button class="seg-btn" type="button" role="radio" :aria-checked="!form.pinned" :class="{ active: !form.pinned }" @click="form.pinned = false">
              普通
            </button>
            <button class="seg-btn" type="button" role="radio" :aria-checked="form.pinned" :class="{ active: form.pinned }" @click="form.pinned = true">
              置顶
            </button>
          </div>
          <span class="hint">置顶站点会排在所属分类的最前，排序模式下仍按手动顺序展示。</span>
        </div>
      </template>
    </div>

    <template #footer>
      <button class="btn btn-ghost" type="button" @click="emit('close')">取消</button>
      <button v-if="bulk" class="btn btn-primary" type="button" :disabled="!bulkText.trim()" @click="submitBulk">
        批量添加
      </button>
      <button v-else class="btn btn-primary" type="button" @click="submit">{{ isEdit ? '保存' : '添加' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
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
