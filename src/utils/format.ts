/** 时间（ISO 字符串或毫秒时间戳）→ YYYY-MM-DD HH:mm；解析失败时原样返回 */
export function formatDateTime(value: string | number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
/** 超过该天数不再展示相对时间，回落到绝对时间 */
const RELATIVE_DAY_LIMIT = 7

/** 时间（ISO 字符串或毫秒时间戳）→ 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前；超过 7 天回落为 formatDateTime */
export function formatRelativeTime(value: string | number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  const diffMs = Date.now() - date.getTime()
  // 服务端时间略微超前时统一按「刚刚」处理
  if (diffMs < MINUTE_MS) return '刚刚'

  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)} 分钟前`
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)} 小时前`

  const days = Math.floor(diffMs / DAY_MS)
  if (days <= RELATIVE_DAY_LIMIT) return `${days} 天前`

  return formatDateTime(value)
}

/** Date → HH:mm:ss（采集/趋势点时间轴用） */
export function formatClockTime(date: Date): string {
  return date.toTimeString().slice(0, 8)
}

/** 秒数 → mm:ss（音视频时长展示）；非法输入返回 '-' */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  const total = Math.round(seconds)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** 毫秒 → HH:MM:SS（视频总时长展示）；非法输入返回 '-' */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** 毫秒 → HH:MM:SS.mmm（场景起止时间点，等宽对齐）；非法输入返回 '-' */
export function formatClockMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const pad = (n: number, length = 2) => String(n).padStart(length, '0')
  const total = Math.floor(ms)
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const millis = total % 1000
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`
}

/** 密钥脱敏：保留首尾各 4 位，中间以 • 代替；空值返回 '-'，过短则整体打码 */
export function maskSecret(value: string): string {
  if (!value) return '-'
  if (value.length <= 8) return '•'.repeat(value.length)
  return `${value.slice(0, 4)}${'•'.repeat(6)}${value.slice(-4)}`
}

/** 字节数 → B/KB/MB/GB/TB（1024 进制）；非法输入返回 '-' */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let value = bytes
  let index = 0
  while (value >= 1024 && index < UNITS.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${UNITS[index]}`
}
