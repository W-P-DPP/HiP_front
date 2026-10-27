import { del, get, post, put } from '@/utils/axios'

import type { AiPlatform, AiPlatformProvider } from '@/types/ai-platform'
import type { PageResult } from '@/types/api'

export const aiPlatformQueryKeys = {
  /** 分页列表 */
  list: ['ai-platform', 'list'] as const,
  /** 支持的平台与预设模型（创建/编辑下拉选项） */
  providers: ['ai-platform', 'providers'] as const,
  /** 单条配置详情 */
  detail: (id: string) => ['ai-platform', 'detail', id] as const,
}

/** 分页查询 AI 平台配置参数（GET /aiPlatforms） */
export interface GetAiPlatformListParams {
  /** 配置名称（可选，模糊匹配） */
  name?: string
  page: number
  limit: number
}

/** 分页查询当前用户的 AI 平台配置列表 */
export const getAiPlatformList = (params: GetAiPlatformListParams) =>
  get<PageResult<AiPlatform>>('/aiPlatforms', { params })

/** 查询支持的平台及其预设模型（GET /aiPlatforms/providers） */
export const getAiPlatformProviders = () =>
  get<{ list: AiPlatformProvider[] }>('/aiPlatforms/providers')

/** 查询单条 AI 平台配置详情（GET /aiPlatforms/:id） */
export const getAiPlatformDetail = (id: string) =>
  get<AiPlatform>(`/aiPlatforms/${id}`)

/** 创建/编辑 AI 平台配置入参（POST、PUT 同一套字段，baseUrl 由后端按 provider 推断） */
export interface AiPlatformParams {
  /** 配置名称 */
  name: string
  /** 平台标识 */
  provider: string
  /** 平台密钥 */
  apiKey: string
  /** 默认模型 id */
  defaultModel: string
}

/** 新增 AI 平台配置（POST /aiPlatforms） */
export const createAiPlatform = (params: AiPlatformParams) =>
  post<AiPlatform>('/aiPlatforms', params)

/** 编辑 AI 平台配置（PUT /aiPlatforms/:id） */
export const updateAiPlatform = (id: string, params: AiPlatformParams) =>
  put<AiPlatform>(`/aiPlatforms/${id}`, params)

/** 删除 AI 平台配置（DELETE /aiPlatforms/:id） */
export const deleteAiPlatform = (id: string) => del<void>(`/aiPlatforms/${id}`)
