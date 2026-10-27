import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { logoutUser } from '@/api/user'
import { clearCookies, redirectToLogin } from '@/utils/auth'

/** 退出登录：后端清 httpOnly cookie → 本地清 cookie 与查询缓存 → 跳转登录页 */
export function useLogout() {
  const inProgress = useRef(false)
  const queryClient = useQueryClient()

  return useCallback(async () => {
    if (inProgress.current) return
    inProgress.current = true
    // 后端退出失败不阻塞本地清理与跳转（错误提示由 axios 拦截器统一弹出）
    try {
      await logoutUser()
    } catch {
      // 忽略：cookie 可能已失效，仍按本地逻辑兜底清理
    }
    clearCookies()
    // 清查询缓存：跳转登录页是同文档 hash 导航，不清会残留上一会话的资料数据
    queryClient.clear()
    redirectToLogin()
  }, [queryClient])
}
