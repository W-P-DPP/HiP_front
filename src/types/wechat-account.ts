/** 微信公众号配置账号 */
export interface WechatAccount {
  _id: string
  userId: string
  name: string
  appId: string
  appSecret: string
  token: string
  encodingAESKey: string
  status: string
  createdAt: string
  updatedAt: string
}
