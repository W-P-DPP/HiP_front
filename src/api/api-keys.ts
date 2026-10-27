import { del, get, post, put } from '@/utils/axios'

import type { PageResult } from '@/types/api'
import type { ApiKey } from '@/types/api-key'

export const apiKeyQueryKeys = {
  list: ['api-key', 'list'] as const,
}

/** 分页查询 API 密钥列表参数（GET /sessions） */
export interface GetApiKeyListParams {
  /** 所属用户 id */
  userId: string
  /** 密钥名称（可选，模糊匹配） */
  name?: string
  page: number
  limit: number
}

/** 分页查询当前用户的 API 密钥列表 */
export const getApiKeyList = (params: GetApiKeyListParams) =>
  get<PageResult<ApiKey>>('/sessions', { params })

/** 新增 API 密钥参数（POST /sessions） */
export interface CreateApiKeyParams {
  /** 所属用户 id */
  userId: string
  /** 密钥名称 */
  name: string
}

/** 新增 API 密钥 */
export const createApiKey = (params: CreateApiKeyParams) =>
  post<ApiKey>('/sessions', params)

/** 编辑 API 密钥名称（PUT /sessions/:id，仅允许改 name） */
export const updateApiKeyName = (id: string, name: string) =>
  put<ApiKey>(`/sessions/${id}`, { name })

/** 删除 API 密钥（DELETE /sessions/:id） */
export const deleteApiKey = (id: string) => del<void>(`/sessions/${id}`)
