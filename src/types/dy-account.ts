/** 抖音应用配置（当前用户维度，一个用户至多一个） */
export interface DyAccount {
  /** 配置记录 ID（更新接口路径参数） */
  _id: string
  /** 归属用户 ID */
  userId: string
  /** 应用名称 */
  name: string
  /** 抖音应用 ClientKey */
  clientKey: string
  /** 抖音应用 ClientSecret */
  clientSecret: string
  /** 状态，如 active */
  status: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}
