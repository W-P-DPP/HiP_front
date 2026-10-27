/** 会话（GET /aiChat/conversations → data.list[]） */
export interface AiConversation {
  _id: string
  userId: string
  /** 关联的 AI 平台配置 id（= AiPlatform._id），创建会话时作为入参 */
  accountId: string
  /** 平台标识，如 commandcode / deepseek */
  provider: string
  title: string
  systemPrompt: string
  /** 会话默认模型 */
  modelName: string
  messageCount: number
  /** 最后一条消息时间，无消息时为 null */
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

/** 消息角色 */
export type AiChatRole = 'user' | 'assistant'

/** 服务端消息状态：上游报错时已生成的内容也会落库，状态为 failed */
export type AiChatMessageStatus = 'success' | 'failed'

/** 消息（GET /aiChat/conversations/:id/messages → data.list[]） */
export interface AiChatMessage {
  _id: string
  conversationId: string
  userId: string
  role: AiChatRole
  content: string
  /** 助手消息实际使用的模型；用户消息为空串 */
  modelName: string
  status: AiChatMessageStatus
  /** 失败原因，成功时为空串 */
  error: string
  tokens: number
  createdAt: string
  updatedAt: string
}

/** 流式首帧：本轮实际使用的模型（请求覆盖或会话默认） */
export interface AiChatStartFrame {
  type: 'start'
  conversationId: string
  model: string
}

/** 流式增量帧：content 恒非空 */
export interface AiChatDeltaFrame {
  type: 'delta'
  content: string
}

/** 流式末帧：messageId 为落库的助手消息 id，content 为拼接后的完整回答 */
export interface AiChatDoneFrame {
  type: 'done'
  messageId: string
  content: string
}

/** 流式错误帧（替代 done 的终止帧） */
export interface AiChatErrorFrame {
  type: 'error'
  message: string
}

export type AiChatStreamFrame =
  | AiChatStartFrame
  | AiChatDeltaFrame
  | AiChatDoneFrame
  | AiChatErrorFrame

/** 对话区展示模型：服务端历史消息与本地流式消息统一成同一结构 */
export interface ChatMessageItem {
  /** 服务端 _id；本地流式消息在落库前用临时 id */
  id: string
  role: AiChatRole
  content: string
  modelName: string
  state: 'done' | 'failed'
  /** 失败原因（落库消息取 error 字段，本地流式取 onError 回调） */
  error?: string
}
