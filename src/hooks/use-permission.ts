import { useUserProfile } from '@/hooks/use-user-profile'
import type { Role } from '@/types/user'

export enum EROLE{
  sadmin=7,
  admin=3,
  user=1,
}

/** 系统角色常量 */
export const ROLE = {
  SADMIN: 'sadmin',
  ADMIN: 'admin',
  USER: 'user',
} as const satisfies Record<string, Role>

export function hasPermission(role:EROLE){
  const { data: profile } = useUserProfile()
  const _role = EROLE[profile?.role as Role]
  if(role<=_role) return true
  return false
}

/** 基于当前登录用户角色的权限判断 hook */
export function usePermission() {
  const { data: profile, isLoading } = useUserProfile()
  const role = profile?.role

  /** 当前角色是否命中给定角色之一；未登录/加载中返回 false */
  const hasRole = (...roles: Role[]): boolean =>
    Boolean(role && roles.includes(role))

  return {
    /** 当前用户角色；加载中为 undefined */
    role,
    /** 命中任一角色返回 true */
    hasRole,
    /** 是否为管理员 */
    isAdmin: hasRole(ROLE.ADMIN),
    /** 个人资料加载中（此时 role 尚未就绪） */
    isLoading,
  }
}
