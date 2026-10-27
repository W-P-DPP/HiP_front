/** API 密钥状态 */
export type ApiKeyStatus = 'active' | 'disabled'

/** API 密钥（对应后端 GET /sessions 列表项） */
export interface ApiKey {
  /** 会话 id */
  _id: string
  /** 所属用户 id */
  userId: string
  /** API 密钥本身 */
  uuid: string
  /** 使用场景说明 */
  scene: string
  /** 密钥名称 */
  name: string
  status: ApiKeyStatus
  /** 有效期（秒） */
  ttl: number
  /** 过期时间（毫秒时间戳） */
  expireAt: number
  /** 签发时间（毫秒时间戳） */
  issuedAt: number
  /** 更新时间（毫秒时间戳） */
  updatedAt: number
}
