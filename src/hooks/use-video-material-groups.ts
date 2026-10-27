import { useQuery } from '@tanstack/react-query'

import {
  getVideoMaterialGroups,
  videoMaterialGroupQueryKeys,
} from '@/api/video-material'

/** 素材分组列表查询：筛选下拉、上传选择、分组管理、卡片徽标共用（同 key 自动复用缓存） */
export function useVideoMaterialGroups() {
  const query = useQuery({
    queryKey: videoMaterialGroupQueryKeys.list,
    queryFn: getVideoMaterialGroups,
  })

  return {
    groups: query.data?.list ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  }
}
