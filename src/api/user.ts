import type { UploadedFile } from '@/types/file'
import type { Role, UserProfile, UserStats, UserTreeNode } from '@/types/user'
import { get, post, put } from '@/utils/axios'
import { encryptPassword } from '@/utils/password'

export const userQueryKeys = {
  profile: ['user', 'profile'] as const,
  children: ['user', 'children'] as const,
  stats: ['user', 'stats'] as const,
}

/** 获取用户统计（GET /users/stats，仅 sadmin 可访问） */
export const getUserStats = () => get<UserStats>('/users/stats')

/** 获取当前登录用户资料（cookie 鉴权） */
export const getUserProfile = () => get<UserProfile>('/users/profile')

/** 更新用户资料参数（PUT /users/:id）；password 省略或空串表示不修改密码 */
export interface UpdateUserProfileParams {
  nickname: string
  /** 留空则不修改密码 */
  password?: string
  /** 头像图片 URL */
  avatar?: string
}

/** 更新用户资料（账号、角色不可修改）；id 为用户 id，走 URL 路径；password 非空时 RSA 加密后提交 */
export const updateUserProfile = async (
  id: string,
  params: UpdateUserProfileParams,
) =>
  put<UserProfile>(`/users/${id}`, {
    ...params,
    // 留空 = 不修改密码，不传 password 字段
    ...(params.password ? { password: encryptPassword(params.password) } : {}),
  })

/** 退出登录：后端清除鉴权 cookie（POST /users/logout） */
export const logoutUser = () =>
  post<null>('/users/logout', undefined, { successMessage: '退出成功' })

/** 上传图片（POST files/upload/multiple），返回头像可访问的完整 URL */
export const uploadAvatar = async (file: File) => {
  const formData = new FormData()
  formData.append('files', file)
  const data = await post<{ created: UploadedFile[]; errors: unknown[] }>(
    '/files/upload/multiple',
    formData,
    {
      successMessage: '头像上传成功', // 覆盖 POST 默认「创建成功」
    },
  )
  const uploaded = data.created[0]
  if (!uploaded) {
    throw new Error('头像上传失败，请重试')
  }
  return `${import.meta.env.VITE_API_BASE_URL}${import.meta.env.VITE_API_BASE_KEY}/files/${uploaded._id}/download`
}

/** 当前用户下全部用户树（GET /users/children，data.list 为以当前用户为根的根级节点） */
export interface UserChildrenResult {
  list: UserTreeNode[]
}

/** 获取当前用户下所有用户的树结构（cookie 鉴权，无需入参） */
export const getUserChildrenList = () => get<UserChildrenResult>('/users/children')

/** 创建子用户参数（POST /users/children）；parentId 由后端按操作者注入 */
export interface CreateChildUserParams {
  account: string
  password: string
  /** 仅当前角色为 sadmin 时传，否则省略由后端默认为 user */
  role?: Role
}

/** 在当前用户下创建子账号（密码 RSA 加密后提交） */
export const createChildUser = async (params: CreateChildUserParams) =>
  post<UserTreeNode>('/users/children', {
    ...params,
    password: encryptPassword(params.password),
  })

