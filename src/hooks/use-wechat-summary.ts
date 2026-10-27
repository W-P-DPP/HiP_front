import { useQuery } from '@tanstack/react-query'

import { getWxArticleStatistics, wechatSummaryQueryKeys } from '@/api/wechat-summary'

/**
 * 公众号发表内容统计：日期 + 目标用户变化驱动取数。范围由调用方持有并传入，
 * userId 为空时不按用户过滤（后端回退当前会话）。extraEnabled 用于等待用户树就绪、
 * 避免先用缺省 userId 发一次请求；进入页面/切回 tab 时本 hook 所在组件重挂即重新请求（全局 staleTime:0）。
 */
export function useWechatArticleStats(
  beginDate: string,
  endDate: string,
  userId?: string,
  extraEnabled = true,
) {
  return useQuery({
    queryKey: wechatSummaryQueryKeys.statistics({ beginDate, endDate, userId }),
    queryFn: () => getWxArticleStatistics({ beginDate, endDate, userId }),
    enabled: Boolean(beginDate && endDate) && extraEnabled,
  })
}
