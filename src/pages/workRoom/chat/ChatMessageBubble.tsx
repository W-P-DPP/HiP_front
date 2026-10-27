import { cn } from '@/lib/utils'
import type { AiChatRole } from '@/types/ai-chat'

export interface ChatMessageBubbleProps {
  role: AiChatRole
  content: string
  /** 助手消息实际使用的模型；用户消息为空 */
  modelName: string
  /** 流式中：文本尾部展示打字光标 */
  isStreaming?: boolean
  /** 失败原因，展示为气泡下方的内联错误 */
  errorMessage?: string
}

/** 对话气泡：用户靠右主色、助手靠左弱色；助手消息在气泡上方展示模型名 */
export function ChatMessageBubble({
  role,
  content,
  modelName,
  isStreaming = false,
  errorMessage,
}: ChatMessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      {!isUser && modelName ? (
        <span className="px-1 font-mono text-xs text-muted-foreground">
          {modelName}
        </span>
      ) : null}
      <div
        className={cn(
          'max-w-[80%] xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {content}
        {isStreaming ? (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground/60 align-middle"
          />
        ) : null}
      </div>
      {errorMessage ? (
        <p className="px-1 text-xs text-destructive">
          {errorMessage}，可修改后重新发送。
        </p>
      ) : null}
    </div>
  )
}
