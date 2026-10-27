import type { ReactNode } from 'react'

import { usePermission } from '@/hooks/use-permission'
import type { Role } from '@/types/user'

interface CanProps {
  /** 拥有这些角色之一即可渲染 children（单个或多个） */
  role: Role | Role[]
  /** 无权限时渲染的内容，默认不渲染 */
  fallback?: ReactNode
  children: ReactNode
}

/** 按角色控制元素显隐：<Can role="admin">...</Can> */
export function Can({ role, fallback = null, children }: CanProps) {
  const { hasRole } = usePermission()
  const roles = Array.isArray(role) ? role : [role]
  return hasRole(...roles) ? children : fallback
}
