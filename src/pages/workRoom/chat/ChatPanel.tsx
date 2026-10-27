import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowUp, MessagesSquare, RotateCcw, Square } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { AiConversation, ChatMessageItem } from '@/types/ai-chat'

import { ChatMessageBubble } from './ChatMessageBubble'

/** 加载态骨架气泡行数 */
const SKELETON_ROWS = 3

export interface ChatPanelProps {
  conversation: AiConversation | null
  messages: ChatMessageItem[]
  /** 流式中打字机已刷出的文本 */
  streamingText: string
  isStreaming: boolean
  loading: boolean
  errorMessage: string | null
  onSend: (content: string) => void
  onStop: () => void
  onRetry: () => void
}

/** 对话区：会话头部 + 消息流 + 输入框 */
export function ChatPanel({
  conversation,
  messages,
  streamingText,
  isStreaming,
  loading,
  errorMessage,
  onSend,
  onStop,
  onRetry,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 新消息或流式增量到达时贴底，跟随最新内容
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [messages.length, streamingText, loading])

  const handleSend = () => {
    const content = input.trim()
    if (!content || isStreaming || !conversation) return
    setInput('')
    onSend(content)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // 输入法组合中（中文候选态）回车用于确认候选，不触发发送
    if (event.nativeEvent.isComposing) return
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    handleSend()
  }

  const isThreadEmpty = messages.length === 0 && !isStreaming

  let thread = (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          role={message.role}
          content={message.content}
          modelName={message.modelName}
          errorMessage={message.error}
        />
      ))}
      {isStreaming ? (
        <ChatMessageBubble
          role="assistant"
          content={streamingText}
          modelName={conversation?.modelName ?? ''}
          isStreaming
        />
      ) : null}
    </div>
  )

  if (!conversation) {
    thread = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center xl bg-muted">
          <MessagesSquare className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            未选择会话
          </span>
          <span className="text-sm text-muted-foreground">
            从左侧选择一个已有会话，或新建会话开始对话。
          </span>
        </div>
      </div>
    )
  } else if (loading) {
    thread = (
      <div className="flex flex-col gap-4">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton
            key={index}
            className={
              index % 2 === 0
                ? 'h-16 w-2/3 xl'
                : 'ml-auto h-16 w-1/2 xl'
            }
          />
        ))}
      </div>
    )
  } else if (errorMessage && isThreadEmpty) {
    thread = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-sm text-destructive">{errorMessage}</span>
        <Button
          variant="outline"
          size="sm"
          data-icon="inline-start"
          onClick={onRetry}
        >
          <RotateCcw />
          重试
        </Button>
      </div>
    )
  } else if (isThreadEmpty) {
    thread = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center xl bg-muted">
          <MessagesSquare className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            开始和 AI 对话吧
          </span>
          <span className="text-sm text-muted-foreground">
            在下方输入问题，回答会逐字流式返回。
          </span>
        </div>
      </div>
    )
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className="truncate text-sm font-medium">
          {conversation?.title ?? '对话'}
        </span>
        {conversation?.modelName ? (
          <Badge variant="outline" className="font-mono">
            {conversation.modelName}
          </Badge>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6"
      >
        {thread}
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              conversation ? '输入消息，Enter 发送' : '请先选择或新建会话'
            }
            disabled={!conversation}
            className="max-h-40 resize-none"
            rows={2}
          />
          {isStreaming ? (
            <Button
              variant="outline"
              data-icon="inline-start"
              onClick={onStop}
            >
              <Square />
              停止生成
            </Button>
          ) : (
            <Button
              data-icon="inline-start"
              onClick={handleSend}
              disabled={!conversation || input.trim() === ''}
            >
              <ArrowUp />
              发送
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </section>
  )
}
