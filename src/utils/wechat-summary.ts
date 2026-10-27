/**
 * 公众号发表内容统计的纯函数：区间/单篇聚合、来源归并、日期与数值格式化。
 * 图表与表格共用，保持无副作用。
 */
import type {
  WxArticleDayStat,
  WxArticleStatItem,
  WxReadJumpPosition,
} from '@/types/wechat-summary'

/** 数值指标区间合计 */
export interface WxAggTotal {
  read: number
  share: number
  zaikan: number
  like: number
  comment: number
  collection: number
  praiseMoney: number
  readSubscribe: number
}

/** 每日趋势数据行（供 recharts） */
export interface WxDailyRow {
  date: string
  read: number
  share: number
  zaikan: number
  like: number
  comment: number
  collection: number
}

/** 阅读来源聚合行 */
export interface WxSourceRow {
  scene: string
  count: number
}

const EMPTY_TOTAL: WxAggTotal = {
  read: 0,
  share: 0,
  zaikan: 0,
  like: 0,
  comment: 0,
  collection: 0,
  praiseMoney: 0,
  readSubscribe: 0,
}

/** 把所有 detail 行展平（全账号概览用） */
export function collectDayRows(list: readonly WxArticleStatItem[]): WxArticleDayStat[] {
  return list.flatMap((article) => article.detail_list)
}

/** 一组每日明细求和为区间合计 */
export function sumDayStats(rows: readonly WxArticleDayStat[]): WxAggTotal {
  return rows.reduce<WxAggTotal>(
    (total, row) => ({
      read: total.read + row.read_user,
      share: total.share + row.share_user,
      zaikan: total.zaikan + row.zaikan_user,
      like: total.like + row.like_user,
      comment: total.comment + row.comment_count,
      collection: total.collection + row.collection_user,
      praiseMoney: total.praiseMoney + row.praise_money,
      readSubscribe: total.readSubscribe + row.read_subscribe_user,
    }),
    EMPTY_TOTAL,
  )
}

/** 汇总单篇全部 detail 到 WxAggTotal（sumDayStats 的无参包装，方便语义化调用） */
export function sumArticle(article: Pick<WxArticleStatItem, 'detail_list'>): WxAggTotal {
  return sumDayStats(article.detail_list)
}

/**
 * 把 [beginDate, endDate] 内每一天都补齐为 0 值行，再叠上给定行按 stat_date 的和。
 * 保证折线横轴连续、无数据日期不会出现断崖式跳空。
 */
export function aggregateDaily(
  rows: readonly WxArticleDayStat[],
  beginDate: string,
  endDate: string,
): WxDailyRow[] {
  const dayMap = new Map<string, WxDailyRow>()
  for (const row of rows) {
    const prev = dayMap.get(row.stat_date)
    dayMap.set(row.stat_date, {
      date: row.stat_date,
      read: (prev?.read ?? 0) + row.read_user,
      share: (prev?.share ?? 0) + row.share_user,
      zaikan: (prev?.zaikan ?? 0) + row.zaikan_user,
      like: (prev?.like ?? 0) + row.like_user,
      comment: (prev?.comment ?? 0) + row.comment_count,
      collection: (prev?.collection ?? 0) + row.collection_user,
    })
  }
  return eachDay(beginDate, endDate).map((date) => dayMap.get(date) ?? toEmptyDaily(date))
}

/** 按存在日期的起止补齐 0 值（单篇趋势：从首条 stat_date 到最后一条，避免整区间前置空期） */
export function aggregateDailyFromRows(rows: readonly WxArticleDayStat[]): WxDailyRow[] {
  if (rows.length === 0) return []
  const dates = rows.map((row) => row.stat_date).sort()
  return aggregateDaily(rows, dates[0], dates[dates.length - 1])
}

/**
 * 阅读来源归并：按 scene_desc 求和并降序。
 * read_user_source 里 scene_desc='全部' 是当日总计行，绘图时必须排除。
 */
export function aggregateSources(rows: readonly WxArticleDayStat[]): WxSourceRow[] {
  const countByScene = new Map<string, number>()
  for (const row of rows) {
    for (const source of row.read_user_source) {
      if (source.scene_desc === '全部') continue
      countByScene.set(source.scene_desc, (countByScene.get(source.scene_desc) ?? 0) + source.user_count)
    }
  }
  return [...countByScene.entries()]
    .map(([scene, count]) => ({ scene, count }))
    .sort((a, b) => b.count - a.count)
}

/** 取含 read_jump_position 的最新一日分布（单篇阅读位置图：避免对占比跨日求和失真） */
export function latestJumpPositions(rows: readonly WxArticleDayStat[]): WxReadJumpPosition[] | null {
  const withPositions = rows.filter((row) => row.read_jump_position?.length)
  if (withPositions.length === 0) return null
  return [...withPositions].sort((a, b) => b.stat_date.localeCompare(a.stat_date))[0].read_jump_position ?? null
}

/** 明细行按 stat_date 升序（供每日明细表） */
export function sortDayStats(rows: readonly WxArticleDayStat[]): WxArticleDayStat[] {
  return [...rows].sort((a, b) => a.stat_date.localeCompare(b.stat_date))
}

/* ---------------- 日期 ---------------- */

function toDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 在本地时区按日推进，返回 YYYY-MM-DD（避免 toISOString 的 UTC 偏移） */
export function addDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + delta)
  return toDateStr(date)
}

/** 枚举 [beginDate, endDate]（含首尾）全部 YYYY-MM-DD */
function eachDay(beginDate: string, endDate: string): string[] {
  const dates: string[] = []
  let cursor = beginDate
  // 防死循环兜底（入参均已由调用方校验 begin <= end）
  for (let guard = 0; cursor <= endDate && guard <= 366; guard += 1) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

/* ---------------- 数值格式化 ---------------- */

function toEmptyDaily(date: string): WxDailyRow {
  return { date, read: 0, share: 0, zaikan: 0, like: 0, comment: 0, collection: 0 }
}

/**
 * 比率字段启发式格式化：微信返回 0–1 的小数占比（≤1 视为 0~100%），
 * 个别口径直接给百分值（>1），统一补 %。
 */
export function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  const percent = value <= 1 ? value * 100 : value
  const rounded = Math.round(percent * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
}

/** 平均阅读时长（秒）→ 可读文案 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 1) return '不足1秒'
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}秒`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest > 0 ? `${minutes}分${rest}秒` : `${minutes}分钟`
}

/** 赞赏金额（分 → 元），保留两位 */
export function formatMoney(fen: number): string {
  return `${(fen / 100).toFixed(2)}`
}

/** 计数千分位 */
export function formatCount(value: number): string {
  return value.toLocaleString('zh-CN')
}
