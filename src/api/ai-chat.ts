import { ApiError, del, get, getApiBaseURL, post } from '@/utils/axios'
import { redirectToLogin } from '@/utils/auth'
import { readSseStream } from '@/utils/sse'

import type { AiChatMessage, AiChatStreamFrame, AiConversation } from '@/types/ai-chat'
import type { PageResult } from '@/types/api'

export const aiChatQueryKeys = {
  /** 会话分页列表 */
  conversations: ['ai-chat', 'conversations'] as const,
  /** 指定会话的历史消息 */
  messages: (conversationId: string) =>
    ['ai-chat', 'messages', conversationId] as const,
}

/** 会话列表与历史消息的公共分页参数（后端分页参数名为 limit，不是 pageSize） */
export interface AiChatPageParams {
  page: number
  limit: number
}

/** 分页查询当前用户的会话列表（GET /aiChat/conversations） */
export const getConversationList = (params: AiChatPageParams) =>
  get<PageResult<AiConversation>>('/aiChat/conversations', { params })

/** 新建会话入参（POST /aiChat/conversations） */
export interface CreateConversationParams {
  /** AI 平台配置 id（= AiPlatform._id），来自平台选择弹框 */
  accountId: string
}

/** 新建会话，返回创建后的会话（标题默认「新对话」） */
export const createConversation = (params: CreateConversationParams) =>
  post<AiConversation>('/aiChat/conversations', params)

/** 删除会话（DELETE /aiChat/conversations/:id） */
export const deleteConversation = (id: string) =>
  del<void>(`/aiChat/conversations/${id}`)

/** 查询指定会话的历史消息（GET /aiChat/conversations/:id/messages） */
export const getConversationMessages = (id: string, params: AiChatPageParams) =>
  get<PageResult<AiChatMessage>>(`/aiChat/conversations/${id}/messages`, {
    params,
  })

/** 流式对话回调配置 */
export interface StreamChatOptions {
  /** 中断控制器：停止生成、切换会话、组件卸载时 abort */
  signal: AbortSignal
  /** 每解析出一帧回调一次 */
  onFrame: (frame: AiChatStreamFrame) => void
  /** 本轮模型覆盖；不传则用会话默认模型 */
  modelName?: string
}

/** 解析一帧 data 内容；非法 JSON 或缺少 type 时返回 null */
function parseStreamFrame(raw: string): AiChatStreamFrame | null {
  try {
    const frame = JSON.parse(raw) as AiChatStreamFrame
    return frame && typeof frame.type === 'string' ? frame : null
  } catch {
    // 忽略无法解析的帧，避免个别脏数据中断整轮流式输出
    return null
  }
}

/** 从非流式响应体中取后端错误文案（参数校验失败时后端仍返回 JSON 包裹） */
async function resolveStreamError(response: Response): Promise<string> {
  const fallback = `请求失败（HTTP ${response.status}）`
  try {
    const body = (await response.json()) as { msg?: string }
    return body?.msg ?? fallback
  } catch {
    return fallback
  }
}

/**
 * 流式对话（POST /aiChat/conversations/:id/chat，text/event-stream）。
 * 用原生 fetch 而非 axios：逐块消费 body 需要 ReadableStream；
 * 也不能用 EventSource（只支持 GET，无法带 body 与自定义头）；
 * cookie 鉴权通过 credentials: 'include' 携带，与 axios 实例的 withCredentials 对齐。
 */
export async function streamConversationChat(
  conversationId: string,
  content: string,
  { signal, onFrame, modelName }: StreamChatOptions,
): Promise<void> {
  const response = await fetch(
    `${getApiBaseURL()}/aiChat/conversations/${conversationId}/chat`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(modelName ? { content, modelName } : { content }),
      signal,
    },
  )

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.includes('text/event-stream')) {
    // 与 axios 拦截器保持一致：cookie 失效直接跳登录页
    if (response.status === 401) redirectToLogin()
    throw new ApiError(response.status, await resolveStreamError(response))
  }

  if (!response.body) {
    throw new ApiError(-1, '当前环境不支持流式响应')
  }

  await readSseStream(response.body, (raw) => {
    const frame = parseStreamFrame(raw)
    if (frame) onFrame(frame)
  })
}
