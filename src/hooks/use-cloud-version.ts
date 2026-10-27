import { useQuery } from '@tanstack/react-query'

import { getCloudVersion, systemQueryKeys } from '@/api/system'

/**
 * 侧边栏品牌区展示的云端部署版本号。
 * 版本号在部署时即固定，标记为永不过期，避免切 tab/窗口聚焦时反复请求与失败提示。
 */
export function useCloudVersion() {
  return useQuery({
    queryKey: systemQueryKeys.cloudVersion,
    queryFn: getCloudVersion,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
