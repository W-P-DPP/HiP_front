/** AI 平台配置状态 */
export type AiPlatformStatus = 'active' | 'disabled'

/** AI 平台配置（GET /aiPlatforms 列表项，与详情、创建/编辑返回结构一致） */
export interface AiPlatform {
  _id: string
  /** 所属用户 id */
  userId: string
  /** 配置名称（列表搜索字段，模糊匹配） */
  name: string
  /** 平台标识，如 deepseek / commandcode */
  provider: string
  /** 平台密钥 */
  apiKey: string
  /** 基础地址，由后端按 provider 推断 */
  baseUrl: string
  /** 默认模型 id */
  defaultModel: string
  status: AiPlatformStatus
  /** 创建时间（ISO 字符串） */
  createdAt: string
  /** 更新时间（ISO 字符串） */
  updatedAt: string
}

/** 平台预设模型（GET /aiPlatforms/providers → presetModels[]） */
export interface AiPlatformPresetModel {
  id: string
  name: string
  /** 上下文长度（token） */
  contextLength: number
}

/** 支持的平台（GET /aiPlatforms/providers → list[]） */
export interface AiPlatformProvider {
  /** 平台标识，与配置的 provider 对应 */
  key: string
  /** 平台展示名 */
  label: string
  baseUrl: string
  presetModels: AiPlatformPresetModel[]
}
