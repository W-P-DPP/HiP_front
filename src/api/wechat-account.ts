import type { PageResult } from '@/types/api'
import type { WechatAccount } from '@/types/wechat-account'
import { get, post, put } from '@/utils/axios'
import type { RequestConfig } from '@/utils/axios'

export const wechatAccountQueryKeys = {
  list: ['wechat-account', 'list'] as const,
}

/** 获取当前用户的公众号配置（分页结构，单账号场景页面取 list[0]） */
export const getWechatAccountList = () =>
  get<PageResult<WechatAccount>>('/wxAccounts')

/** 公众号配置五字段，创建与更新共用同一结构 */
export interface WechatAccountParams {
  name: string
  appId: string
  appSecret: string
  token: string
  encodingAESKey: string
}

/** 创建当前账号的公众号配置（仅首次保存、账号尚无配置时调用，归属账号由登录会话决定） */
export const createWechatAccount = (
  params: WechatAccountParams,
  config?: RequestConfig,
) => post<WechatAccount>('/wxAccounts', params, config)

/** 修改公众号配置（账号已有配置时调用，id 取账号 _id） */
export const updateWechatAccount = (
  id: string,
  params: WechatAccountParams,
  config?: RequestConfig,
) => put<WechatAccount>(`/wxAccounts/${id}`, params, config)
