import type { DyAccount } from '@/types/dy-account'
import { ApiError, get, post, put } from '@/utils/axios'
import type { RequestConfig } from '@/utils/axios'
import { message } from '@/utils/message'

export const dyAccountQueryKeys = {
  mine: ['dy-account', 'mine'] as const,
}

/** 后端「当前用户尚未配置」的业务码：GET /dyAccounts/mine 无配置时返回 code 404 */
const NOT_CONFIGURED_CODE = 404

/**
 * 获取当前用户的抖音应用配置。
 * 未配置时后端返回业务码 404（msg「抖音应用配置不存在」），此处视为「无配置」返回 null，
 * 页面据此展示空表单、保存走新增接口；silent 抑制该场景下的全局错误提示。
 */
export const getMyDyAccount = async (): Promise<DyAccount | null> => {
  try {
    return await get<DyAccount | null>('/dyAccounts/mine', { silent: true })
  } catch (error) {
    if (error instanceof ApiError && error.code === NOT_CONFIGURED_CODE) {
      return null
    }
    // 非「未配置」的真实错误：silent 抑制了拦截器提示，这里补回，页面同时展示重试卡片
    if (error instanceof Error) message.error(error.message)
    throw error
  }
}

/** 抖音应用配置三字段，创建与更新共用同一结构 */
export interface DyAccountParams {
  name: string
  clientKey: string
  clientSecret: string
}

/** 新增抖音应用配置（仅首次保存、当前用户尚无配置时调用，归属由登录会话决定） */
export const createDyAccount = (
  params: DyAccountParams,
  config?: RequestConfig,
) => post<DyAccount>('/dyAccounts', params, config)

/** 修改抖音应用配置（已有配置时调用，id 取配置 _id） */
export const updateDyAccount = (id: string, params: DyAccountParams) =>
  put<DyAccount>(`/dyAccounts/${id}`, params)
