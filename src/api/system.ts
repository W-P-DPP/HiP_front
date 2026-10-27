import type { SystemResources,SystemVersion } from '@/types/system'
import { get } from '@/utils/axios'

export const systemQueryKeys = {
  resources: ['system', 'resources'] as const,
  cloudVersion: ['system', 'cloudVersion'] as const,
}

/** 获取系统资源（轮询使用，silent 跳过全局成功/失败消息） */
export const getSystemResources = () =>
  get<SystemResources>('/system/resources', { silent: true })

/** 获取云端部署版本号（/system/cloudVersion 返回 HIP_VERSION 字符串，如 "1.0.0"） */
export const getCloudVersion = () => get<SystemVersion>('/system/version')
