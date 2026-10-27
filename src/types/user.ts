/** 系统角色：admin 管理员 / user 普通用户；新增角色时扩展此联合类型 */
export type Role = 'admin' | 'user' | 'sadmin'

/** 当前登录用户资料（/users/profile），字段以后端实际返回为准 */
export interface UserProfile {
  id: string
  account: string
  /** 明文密码，仅后端返回；前端不回显，仅在修改密码时提交 */
  password?: string
  nickname: string
  /** 系统角色，用于前端权限控制 */
  role: Role
  avatar?: string
  createdAt?: string
}

/** 每日新增用户数（GET /users/stats 的 dailyNew 字段，按日期升序） */
export interface DailyNewUserCount {
  /** 日期（YYYY-MM-DD） */
  date: string
  /** 当日新增用户数 */
  count: number
}

/** 用户统计（GET /users/stats 返回的 data，仅 sadmin 可访问） */
export interface UserStats {
  /** 用户总数 */
  total: number
  /** 今日新增用户数 */
  newToday: number
  /** 每日新增用户数趋势 */
  dailyNew: DailyNewUserCount[]
}

/** 用户树节点（GET /users/children 返回，children 递归、叶子为空数组） */
export interface UserTreeNode {
  id: string
  account: string
  nickname: string
  avatar?: string
  role: Role
  parentId: string | null
  createdAt?: string
  children: UserTreeNode[]
}

