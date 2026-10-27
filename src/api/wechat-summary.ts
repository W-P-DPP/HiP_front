import type { WxStatisticsQuery, WxStatisticsResult } from '@/types/wechat-summary'
import { get, getServiceBaseURL } from '@/utils/axios'

export const wechatSummaryQueryKeys = {
  statistics: (query: WxStatisticsQuery) =>
    ['wechat-summary', 'statistics', query.beginDate, query.endDate, query.userId] as const,
}

/**
 * 获取公众号发表内容统计（按文章归并 + 每日明细）。
 * 该接口挂在 `${base}/wx` 下不带 /api 段，故用 getServiceBaseURL() 覆盖请求 base；
 * 冷查会逐日打微信远端，单独放宽超时。传入 userId 时按目标用户公众号取数，否则按当前会话。
 */
export const getWxArticleStatistics = ({ beginDate, endDate, userId }: WxStatisticsQuery) =>
  get<WxStatisticsResult>('/wx/summary/getSummary/statistics', {
    params: {
      begin_date: beginDate,
      end_date: endDate,
      ...(userId ? { userId } : {}),
    },
    baseURL: getServiceBaseURL(),
    timeout: 60_000,
  })
