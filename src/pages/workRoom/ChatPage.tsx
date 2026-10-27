import { useCallback, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import {
  aiChatQueryKeys,
  deleteConversation,
  getConversationList,
  getConversationMessages,
} from '@/api/ai-chat'
import { CreateConversationDialog } from '@/components/CreateConversationDialog'
import { Button } from '@/components/ui/button'
import { useChatStream } from '@/hooks/use-chat-stream'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import type {
  AiChatMessage,
  AiConversation,
  ChatMessageItem,
} from '@/types/ai-chat'

import { ChatPanel } from './chat/ChatPanel'
import { ConversationList } from './chat/ConversationList'

/** 历史消息一次拉取的条数 */
const MESSAGE_PAGE_LIMIT = 50
/** 会话列表每页条数 */
const CONVERSATION_PAGE_SIZE = 20

/** 服务端消息 → 对话区展示模型 */
function toMessageItem(message: AiChatMessage): ChatMessageItem {
  return {
    id: message._id,
    role: message.role,
    content: message.content,
    modelName: message.modelName,
    state: message.status === 'failed' ? 'failed' : 'done',
    error: message.error || undefined,
  }
}

/**
 * 工作台智能对话页：左侧会话列表 + 右侧对话区。
 * 消息列表是本地状态（流式输出需持续增量改写最后一条消息，
 * 若与 react-query 缓存合并会在窗口聚焦自动 refetch 时出现重复消息）；
 * 会话列表仍走 usePaginationQuery，历史消息在选择会话时按需拉取。
 */
export function ChatPage() {
  const navigate = useNavigate()

  const [activeConversation, setActiveConversation] =
    useState<AiConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  // 弹框打开计数：作为 key 保证每次打开都重置平台选择（同 AiPlatformDialog 的做法）
  const [createSession, setCreateSession] = useState(0)

  // 当前会话 id 的即时值：流式回调里判断是否已切走（state 在闭包中会过期）
  const activeIdRef = useRef<string | null>(null)
  // 历史消息请求令牌：切换会话时丢弃迟到的响应
  const loadTokenRef = useRef(0)

  const {
    data: conversations,
    isLoading: isConversationsLoading,
    error: conversationsError,
    page,
    totalPages,
    refetch: refetchConversations,
    setPage,
  } = usePaginationQuery<AiConversation>({
    queryKey: aiChatQueryKeys.conversations,
    queryFn: ({ page: currentPage, pageSize }) =>
      getConversationList({ page: currentPage, limit: pageSize }),
    initialPageSize: CONVERSATION_PAGE_SIZE,
  })

  const deleteMutation = useMutation({ mutationFn: deleteConversation })
  const { isStreaming, streamingText, startStream, stopStream } = useChatStream()

  const loadMessages = useCallback(async (conversationId: string) => {
    loadTokenRef.current += 1
    const token = loadTokenRef.current
    setIsLoadingMessages(true)
    setMessagesError(null)
    try {
      const result = await getConversationMessages(conversationId, {
        page: 1,
        limit: MESSAGE_PAGE_LIMIT,
      })
      if (token !== loadTokenRef.current) return
      setMessages(result.list.map(toMessageItem))
    } catch (error) {
      if (token !== loadTokenRef.current) return
      setMessagesError(
        error instanceof Error ? error.message : '历史消息加载失败',
      )
    } finally {
      if (token === loadTokenRef.current) setIsLoadingMessages(false)
    }
  }, [])

  /** 切换（或清空）当前会话：中断进行中的流式输出并重置对话区 */
  const selectConversation = useCallback(
    (conversation: AiConversation | null) => {
      stopStream()
      activeIdRef.current = conversation?._id ?? null
      setActiveConversation(conversation)
      setMessages([])
      setMessagesError(null)
      setIsLoadingMessages(false)
      if (conversation) void loadMessages(conversation._id)
    },
    [loadMessages, stopStream],
  )

  const handleSelectConversation = useCallback(
    (conversation: AiConversation) => {
      if (conversation._id === activeIdRef.current) return
      selectConversation(conversation)
    },
    [selectConversation],
  )

  const handleOpenCreate = useCallback(() => {
    setCreateSession((session) => session + 1)
    setCreateOpen(true)
  }, [])

  const handleCreateSuccess = useCallback(
    (conversation: AiConversation) => {
      refetchConversations()
      selectConversation(conversation)
    },
    [refetchConversations, selectConversation],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id)
        // 删除的是当前会话时回到初始对话页
        if (activeIdRef.current === id) selectConversation(null)
        refetchConversations()
      } catch {
        // 失败提示已由 axios 拦截器统一处理
      }
    },
    [deleteMutation, refetchConversations, selectConversation],
  )

  const handleReloadMessages = useCallback(() => {
    const conversationId = activeIdRef.current
    if (conversationId) void loadMessages(conversationId)
  }, [loadMessages])

  const handleSend = useCallback(
    (content: string) => {
      const conversationId = activeIdRef.current
      if (!conversationId) return

      setMessages((previous) => [
        ...previous,
        {
          id: `local-user-${Date.now()}`,
          role: 'user',
          content,
          modelName: '',
          state: 'done',
        },
      ])

      // 气泡上的模型名取会话默认模型（start 帧的真实模型未落到展示层）
      const modelName =
        conversations.find((item) => item._id === conversationId)?.modelName ??
        ''

      const appendAssistantMessage = (payload: {
        id?: string
        content: string
        state: ChatMessageItem['state']
        error?: string
      }) => {
        setMessages((previous) => [
          ...previous,
          {
            id: payload.id ?? `local-assistant-${Date.now()}`,
            role: 'assistant',
            content: payload.content,
            modelName,
            state: payload.state,
            error: payload.error,
          },
        ])
      }

      // 用户已切走会话时丢弃本轮结果（切走会中断流，仍可能有一次迟到的回调）
      const isStillActive = () => activeIdRef.current === conversationId

      void startStream(conversationId, content, {
        onDone: ({ messageId, content: answer }) => {
          if (!isStillActive()) return
          appendAssistantMessage({
            id: messageId || undefined,
            content: answer,
            state: 'done',
          })
          // 标题、消息数、最后消息时间已变化
          refetchConversations()
        },
        onError: (errorMessage, partial) => {
          if (!isStillActive()) return
          appendAssistantMessage({
            content: partial,
            state: 'failed',
            error: errorMessage,
          })
          refetchConversations()
        },
        onStop: (partial) => {
          if (!isStillActive()) return
          appendAssistantMessage({
            content: partial,
            state: 'failed',
            error: '已停止生成',
          })
          refetchConversations()
        },
      })
    },
    [conversations, refetchConversations, startStream],
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Button
        variant="ghost"
        data-icon="inline-start"
        className="w-fit"
        onClick={() => navigate('/work-room')}
      >
        <ArrowLeft />
        返回工作台
      </Button>

      {/* 用视口约束高度，保证左右两栏各自内部滚动而不是撑高整页；窄屏改为上下堆叠 */}
      <div className="flex h-[calc(100dvh-12rem)] min-h-[28rem] flex-col gap-6 md:h-[calc(100dvh-11rem)] lg:flex-row">
        <ConversationList
          conversations={conversations}
          activeId={activeConversation?._id ?? null}
          loading={isConversationsLoading}
          error={conversationsError}
          deleting={deleteMutation.isPending}
          page={page}
          totalPages={totalPages}
          onSelect={handleSelectConversation}
          onCreate={handleOpenCreate}
          onDelete={handleDelete}
          onRetry={refetchConversations}
          onPageChange={setPage}
        />
        <ChatPanel
          conversation={activeConversation}
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          loading={isLoadingMessages}
          errorMessage={messagesError}
          onSend={handleSend}
          onStop={stopStream}
          onRetry={handleReloadMessages}
        />
      </div>

      <CreateConversationDialog
        key={`create-conversation-${createSession}`}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
