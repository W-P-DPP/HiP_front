import { Navigate, Outlet } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { useUserProfile } from '@/hooks/use-user-profile'

/**
 * 受保护路由守卫：进入前校验当前登录用户资料（cookie 鉴权）。
 * - 加载中：全屏占位（与登录页同底色，避免闪烁）
 * - 未登录 / 资料拉取失败（含 401）：重定向到登录页
 * - 已登录：渲染子路由
 */
export function RequireAuth() {
  const { data: profile, isLoading } = useUserProfile()

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40">
        <Skeleton className="h-8 w-32" />
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />

  return <Outlet />
}
