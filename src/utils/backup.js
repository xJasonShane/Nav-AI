/**
 * 备份健康度（侧键，不进入数据 schema）：
 *  - 记录最近一次完整备份（JSON 导出）的时间
 *  - 记录首次使用时间，作为「从未备份」提醒的起点
 *  - 提醒被关闭后 7 天内不再打扰
 *
 * 所有读写都吞掉异常：隐私模式下存储不可用时，只是不提醒，不影响主流程。
 */
const LAST_EXPORT_KEY = 'nav-ai-last-export'
const FIRST_SEEN_KEY = 'nav-ai-first-seen'
const SNOOZE_KEY = 'nav-ai-backup-snooze'

const DAY = 24 * 60 * 60 * 1000
const SNOOZE_DAYS = 7
export const BACKUP_INTERVAL_DAYS = 30

function readTime(key) {
  try {
    const value = Number(localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch (e) {
    return 0
  }
}

/** 首次打开时记录起点；已有值不覆盖 */
export function touchFirstSeen(now = Date.now()) {
  try {
    if (!localStorage.getItem(FIRST_SEEN_KEY)) localStorage.setItem(FIRST_SEEN_KEY, String(now))
  } catch (e) {
    /* 存储不可用时忽略 */
  }
}

/** 完整备份成功后调用（JSON 下载 / 复制）；同时解除休眠，让下一次周期重新计时 */
export function markExported(at = Date.now()) {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, String(at))
    localStorage.removeItem(SNOOZE_KEY)
  } catch (e) {
    /* 存储不可用时忽略 */
  }
}

/** 最近一次完整备份时间；从未备份返回 null */
export function lastExportedAt() {
  return readTime(LAST_EXPORT_KEY) || null
}

/**
 * 是否需要在界面上提醒备份。
 * 起点取「最近备份」或「首次使用」，超过 30 天且不在 7 天休眠期内才提醒。
 */
export function shouldRemindBackup(now = Date.now(), days = BACKUP_INTERVAL_DAYS) {
  const last = readTime(LAST_EXPORT_KEY)
  const first = readTime(FIRST_SEEN_KEY) || now
  const since = last || first
  if (now - since < days * DAY) return false
  const snoozed = readTime(SNOOZE_KEY)
  return !(snoozed && now - snoozed < SNOOZE_DAYS * DAY)
}

/** 用户关闭提醒后休眠 7 天 */
export function snoozeBackupReminder(at = Date.now()) {
  try {
    localStorage.setItem(SNOOZE_KEY, String(at))
  } catch (e) {
    /* 存储不可用时忽略 */
  }
}
