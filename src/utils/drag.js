/**
 * 拖拽排序的共享状态：卡片拖拽时，被拖项与当前悬停目标在本模块内共享，
 * 避免把状态层层透传到 App.vue 的三处卡片列表。
 */
import { ref } from 'vue'

/** 正在拖拽的站点 id */
export const draggingId = ref(null)
/** 当前悬停的目标站点 id */
export const dropTargetId = ref(null)
/** 落点是否在目标卡片的后半侧（决定插入到前 / 后） */
export const dropAfter = ref(false)

export function resetDrag() {
  draggingId.value = null
  dropTargetId.value = null
  dropAfter.value = false
}
