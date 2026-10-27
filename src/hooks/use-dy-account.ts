import { useQuery } from '@tanstack/react-query'

import { dyAccountQueryKeys, getMyDyAccount } from '@/api/dy-account'

/** 获取当前用户的抖音应用配置（未配置时为 null） */
export function useDyAccount() {
  return useQuery({
    queryKey: dyAccountQueryKeys.mine,
    queryFn: getMyDyAccount,
  })
}
