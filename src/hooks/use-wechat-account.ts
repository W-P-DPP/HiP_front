import { useQuery } from '@tanstack/react-query'

import { getWechatAccountList, wechatAccountQueryKeys } from '@/api/wechat-account'

/** 获取当前用户的公众号配置（单账号场景取列表第一条，未配置时为 null） */
export function useWechatAccount() {
  return useQuery({
    queryKey: wechatAccountQueryKeys.list,
    queryFn: getWechatAccountList,
    select: (data) => data.list[0] ?? null,
  })
}
