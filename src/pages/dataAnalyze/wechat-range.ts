/**
 * 公众号统计查询的日期区间助手：快捷预设、跨度校验。
 * 单独成模块（非组件文件），供 dataAnalyzePage / WechatStatTab 复用，避免 fast-refresh 误报。
 */
import type { WxStatRange } from '@/types/wechat-summary'
import { addDays } from '@/utils/wechat-summary'

/** 后端 statistics 单次查询最大跨度（天，含首尾） */
export const MAX_RANGE_DAYS = 31

/** 昨天（YYYY-MM-DD） */
function yesterdayStr(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 以昨天为终点、往前 days 天（含终点）的快捷区间 */
export function presetRange(days: number): WxStatRange {
  const endDate = yesterdayStr()
  return { beginDate: addDays(endDate, -(days - 1)), endDate }
}

/** 自然日跨度（含首尾） */
export function spanDays(beginDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(beginDate).getTime()
  return Math.round(diff / 86_400_000) + 1
}
