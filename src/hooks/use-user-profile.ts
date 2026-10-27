import { useQuery } from '@tanstack/react-query'

import { getUserProfile, userQueryKeys } from '@/api/user'

export function useUserProfile() {
  return useQuery({
    queryKey: userQueryKeys.profile,
    queryFn: getUserProfile,
  })
}
